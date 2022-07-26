import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../services/socket.service';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild("canvas") canvas:ElementRef;

  images:string[] = [
    "cannon.png","car.webp","cat.png",
    "dog.webp","hat.png","horse.webp",
    "Iron.webp", "penguin.png", "ship.webp",
    "shoe.png","thimble.png", "wheelbarrow.webp"
  ];



  canDraw:boolean = false;
  gameStart:boolean = false;
  playerTurn:boolean = false;
  displayWordChoice:boolean = false;
  currentRound:number = 1;
  gameOver:boolean = false;
  displayScoreBoard = false;

  wordLength:number;

  currentColor:string = "blue";
  currentUtencil:string = "pencil";
  lineWidth:string = "sm";
  wordGuess:string = "";
  actualWord:string = "";
  wordChoices:string[] = [];

  chatList:any[] = [];

  timer:number;

  timerInterval:any;
  
  private clickDownListener:()=>void;
  private clickUpListener:()=>void;
  private mouseMoveListener:()=>void;

  private prevX:number = null;
  private prevY:number = null;

  private ctx:any;

  players:any[];

  constructor(
    private renderer:Renderer2,
    private server:SocketService,
    private router:Router
  ) {
    
   }

  ngOnInit(): void {
    this.gameStart = this.server.gameStarted;
    this.playerTurn = this.server.playerTurn;
    this.players = this.server.players;

    this.server.actualWord$.subscribe(word => {
      this.actualWord = word;
    })

    this.server.players$.subscribe(players => {
      this.players = players;
      console.log(players);
    });

    this.server.playerTurn$.subscribe(playerTurn => {
      this.playerTurn = playerTurn;

      if(playerTurn){
        this.server.refreshWordChoices();
        this.displayWordChoice = true;
        this.server.broadcastMessage({
          roomId:this.server.roomId,
          username: this.server.username,
          isNotification:true,
          message: this.server.username + " is now choosing a word"
        });
      }
    });

    this.server.chat$.subscribe((chat:any[])=> {
      this.chatList = chat;
    })

    this.server.wordChoices$.subscribe((words:string[])=>{
      this.wordChoices = words;
    });

    this.server.gameStarted$.subscribe(started=> {
      this.gameStart = started;
      setTimeout(()=>{
        this.initializeCanvas();
      },400);
    });

    this.server.drawData$.subscribe((drawData)=> {
      this.draw(drawData);
    })

    this.server.startClock$.subscribe(clockStart =>{
      if(!clockStart) return;
      this.timer = this.server.gameOptions.timer;


      this.timerInterval = setInterval(()=>{
        if(this.timer === 0){
          this.displayScoreBoard = true;
          this.onClearCanvas();
          setTimeout(()=> {
              this.displayScoreBoard = false;
              if(this.playerTurn){
                this.canDraw = false;
                this.server.signalNextTurn();
              }
            },5000);
          if(this.timerInterval)
            return clearInterval(this.timerInterval);
        }
        this.timer--;
      },1000);
    });


    this.server.triggerRound$.subscribe(trigger => {
      if(!trigger)return;

      this.handleTimer();
    });


    this.server.gameOver$.subscribe(gameover => {
      if(!gameover) return;
      clearInterval(this.timerInterval);
      this.gameOver = true;
    });


    this.server.currentRound$.subscribe(round => {
      this.currentRound = round;
    })
    
  } // 

  handleTimer():void{
      if(this.timerInterval)
        clearInterval(this.timerInterval)
      this.timer = 0;
      this.displayScoreBoard = true;
      this.onClearCanvas();
      setTimeout(()=> {
          this.displayScoreBoard = false;
          if(this.playerTurn){
            this.canDraw = false;
            this.server.signalNextTurn();
          }
      },5000);
  }


  ngAfterViewInit(): void {
    
  }


  onSelectPaint(color:string):void{
    if(this.currentUtencil ==='eraser') return;

    this.ctx.strokeStyle = color;
    this.currentColor = color;
  }


  onSelectUtencil(utencil:string):void{
    this.currentUtencil = utencil;

    if(utencil === 'eraser')
      this.ctx.strokeStyle = 'white';

    else
      this.onSelectPaint(this.currentColor);
  }

  
  isSelectedLineWidth(width:string):any{
    if(this.lineWidth === width)
      return {'background': 'var(--skribbl-primary)', 'color':'white'};
    return null;
  }

  setLineWidth(width:number,widthLabel:string):void{
    this.ctx.lineWidth = width;
    this.lineWidth = widthLabel;
  }

  displayWordHint():string{
    if(this.server.playerTurn)
      return this.actualWord;
    return "_".repeat(this.actualWord.length);
  }

  onClearCanvas():void{
    this.ctx.clearRect(
      0,
      0,
      this.canvas.nativeElement.width, 
      this.canvas.nativeElement.height
    );
  }


  onSubmitAnswer(event:KeyboardEvent):void{
    if(event.key !=='Enter') return;

    this.server.broadcastMessage({
      roomId: this.server.roomId,
      username: this.server.username,
      isNotification: false,
      message: this.wordGuess
    });
  }

  onSelectWordChoice(choice:string):void{
    this.actualWord = choice;
    this.displayWordChoice = false;
    this.server.setSelectedWord(choice);
    // set the timer once this has been completed
    this.server.startClock();
  }

  onRefreshWordSelection():void{
    this.server.refreshWordChoices();
  }

  ngOnDestroy(): void {
    this.clickDownListener();
    this.clickUpListener();
    this.mouseMoveListener();
  }

  draw({color, currentX, currentY, prevX, prevY}):void {
     let offsetX = this.canvas.nativeElement.getBoundingClientRect().x;
     let offsetY = this.canvas.nativeElement.getBoundingClientRect().y;
     this.ctx.strokeStyle = color;
     this.ctx.beginPath();
     this.ctx.moveTo(prevX-offsetX,prevY-offsetY);
     this.ctx.lineTo(currentX - offsetX, (currentY-offsetY));
     this.ctx.stroke();
  }


  onSetPlace(place:number):string{
    if(place === 1) return "st";
    else if(place === 2) return "nd";
    else if(place === 3) return "rd";
    return "th";
  }

  onNavigate(path:string):void{
    this.router.navigate(['home']);
  }


  initializeCanvas():void{
    this.canvas.nativeElement.height = 650;
    this.canvas.nativeElement.width = 950; 
    this.ctx = this.canvas.nativeElement.getContext("2d");
    this.ctx.lineWidth = 5
    this.ctx.strokeStyle = "blue";
    this.clickDownListener = this.renderer.listen(this.canvas.nativeElement, 'mousedown', ()=>{ 
      if(!this.playerTurn) return;
      this.canDraw = true
    });
    this.clickUpListener = this.renderer.listen(this.canvas.nativeElement, 'mouseup', ()=>{
      if(!this.playerTurn) return;
       this.canDraw = false
      });
    
    this.mouseMoveListener = this.renderer.listen(this.canvas.nativeElement, 'mousemove',(e:MouseEvent)=> {
      if(this.prevX === null || this.prevY === null || !this.canDraw){
        this.prevX = e.clientX;
        this.prevY = e.clientY;
        return;
      }

      let currentX = e.clientX;
      let currentY = e.clientY;

      /*Offset for when the page resizes,*/
      let offsetX = this.canvas.nativeElement.getBoundingClientRect().x;
      let offsetY = this.canvas.nativeElement.getBoundingClientRect().y;

      /* Code for the actual drawing */
      this.ctx.beginPath();
      this.ctx.moveTo(this.prevX-offsetX,this.prevY-offsetY);
      this.ctx.lineTo(currentX - offsetX, currentY-offsetY);
      this.ctx.stroke();

      this.server.emitDrawSegment({
        color: this.ctx.strokeStyle,
        roomId: this.server.roomId,
        currentX: currentX,
        currentY: currentY,
        prevX: this.prevX,
        prevY: this.prevY
      });

      this.prevX = currentX;
      this.prevY = currentY;
    });
  }
}
