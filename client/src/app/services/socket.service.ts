import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { io } from "socket.io-client";
import { ImageUpdate, OptionsUpdate, Player } from "../models/GameResources";



@Injectable({providedIn:'root'})
export class SocketService {

    private socket:any;
    clientId:any;

    players:Player[] = [];
    wordChoices:string[] = [];
    chat:any[] = [];

    players$ = new Subject<Player[]>();
    gameOptions$ = new Subject<OptionsUpdate>();
    gameStarted$ = new Subject<boolean>();
    host$ = new Subject<boolean>();
    clientId$ = new Subject<string>();
    playerTurn$ = new Subject<boolean>();
    actualWord$ = new Subject<string>();
    wordChoices$ = new Subject<string[]>();
    startClock$ = new Subject<boolean>();
    drawData$ = new Subject<any>();
    triggerRound$ = new Subject<boolean>();
    chat$ = new Subject<any>();
    paintSelection$ = new Subject<string>();
    gameOver$ = new Subject<boolean>();
    currentRound$ = new Subject<number>();
    actualWord:string = "";

    private _isHost:boolean = false;
    gameStarted:boolean = false;
    playerTurn:boolean = false;


    private _username:string = "";
    roomId:string;

    gameOptions:OptionsUpdate = null;


    constructor(){

        this.socket = io('http://localhost:3001');

        this.socket.on('deliver_client_id',(data)=> {
            this.clientId = data;
            this.clientId$.next(data);
        });

        /**/
        this.socket.on('update-user-list',gameData=> {
            this.players = gameData.userList.sort((a:Player,b:Player)=>{
                    return b.points-a.points;
            });
            this.players$.next(gameData.userList);
        });

        this.socket.on('updated-image',(players:Player[])=> {
            this.players = players;
            this.players$.next(players);
        });

        this.socket.on('updated-game-options',(data)=> {
            this.updateGameOptions(data);
        })

        this.socket.on('game-start',(started:boolean)=> {
            this.gameStarted = started;
            this.gameStarted$.next(started)
        });

        this.socket.on('get-word-choices',(words:string[])=>{
            console.log(words)
            this.wordChoices = words;
            this.wordChoices$.next(words);
        })

        this.socket.on('receive-word',(word:string)=> {
            this.actualWord = word;
            this.actualWord$.next(word);
        });


        this.socket.on('start-clock',()=>{
            this.startClock$.next(true);
            this.broadcastMessage({
                roomId: this.roomId,
                username: "@server",
                isNotification: true,
                message:"The game has started!"
            })
        });

        this.socket.on('receive-message',message => {
            this.chat.push(message);
            this.chat$.next(this.chat);
        });


        this.socket.on('receive-draw-segment',(drawData:{
            roomId: string, 
            currentX:number, 
            currentY:number, 
            prevX:number, 
            prevY:number
        })=> {
            console.log('receiving draw segment');
            this.drawData$.next(drawData);
        });


        this.socket.on('player-turn',(turn)=> {
            this.playerTurn = turn;
            this.playerTurn$.next(turn);
        });

        this.socket.on('trigger-next-round',()=>{
            this.triggerRound$.next(true)
        });

        
        this.socket.on('game-over',()=>{
            this.gameOver$.next(true);
        })

        this.socket.on('update-round', round => {
            this.currentRound$.next(round);
        })

    }

 
    /*
    * Creates a new room using the roomId property and makes the caller the 
    * host of that room.
    */
    createRoom(roomId:string):Observable<boolean>{
        const data = {
            username:this._username, 
            points: 0,
            correctlyGuessed:false,
            isHost:true,
            image: '',
            id: this.clientId, 
            roomId:roomId
        };
        return new Observable<boolean>((observer)=>{
            this.socket.emit('create-room',data,(successful:boolean,gameData:any)=>{
                this.unpack({...gameData, roomId:data.roomId}); //
                observer.next(successful);
                observer.complete();
            });
        })
    }


    /*
    * Joins a room with a specific roomId. User will not have host privleges. Method will
    * return false and redirect back to home if the room does not exist.
    */
    joinRoom(roomId:string):Observable<boolean>{
        let data:Player = {
            username:this._username, 
            points: 0,
            correctlyGuessed:false,
            isHost:false,
            image:'',
            id:this.clientId, 
            roomId:roomId
        };
        return new Observable<boolean>((observer)=>{
            this.socket.emit('join-room',data,(successful:boolean,gameData:any)=> {
                this.unpack({...gameData,roomId:data.roomId}); //
                observer.next(successful);
                observer.complete();
            });
        })
    }


    /*
    * User will find a random room to join. If there are no available rooms, 
    * the server will redirect back to the login screen.
    */
    joinRandomRoom():Observable<boolean>{
        let data:Player = {
            username:this.username, 
            points:0,
            correctlyGuessed:false,
            isHost:false,
            image:'',
            id:this.clientId
        };
        return new Observable<boolean>((observer)=> {
            this.socket.emit('join-random-room',data,(successful:boolean, roomId:string, gameData:any)=> {
                this.unpack({...gameData,roomId:roomId})
                observer.next(successful);
                observer.complete();
            })
        });
    }


    /* Creates user information for the server register the user */
    initUser(username:string, ishost:boolean){
        this._username = username;
        this._isHost = ishost;
    }


    selectPlayerImage(image:string):void{
        const imageUpdate:ImageUpdate = {
            image:image, 
            id:this.clientId, 
            roomId: this.roomId
        }
        this.socket.emit('choose-image',imageUpdate,(players:Player[])=>{
            this.players = players;
            this.players$.next(players);
        });
    }


    /*
    * Notify the changes in the lobby/game settings so that all users in the room can see
    */
    updateGameSettings(options:OptionsUpdate):void{
        this.gameOptions = {...options};

        //append the roomId to the options
        options.roomId = this.roomId;
        this.socket.emit('update-game-settings',options);
    }


    startGame():void{
        this.gameStarted = true;
        this.gameStarted$.next(true);
        this.socket.emit('notify-game-start',{roomId:this.roomId, started:this.gameStarted},({playerTurn, wordChoices})=>{
            this.playerTurn = playerTurn;
            this.wordChoices = wordChoices;
            this.playerTurn$.next(playerTurn);
        });
    }


    setSelectedWord(choice:string):void{
        this.actualWord = choice;
        this.socket.emit('selected-word',{choice:choice, roomId:this.roomId});
    }

    refreshWordChoices():void{
        this.socket.emit('refresh-word-choices');
    }


    startClock():void{
        this.startClock$.next(true);
        this.socket.emit('server-start-clock',this.roomId);
    }


    emitDrawSegment(data:{
        color:string,
        roomId: string, 
        currentX:number, 
        currentY:number, 
        prevX:number, 
        prevY:number
    }):void{
        console.log('drawing segment')
        this.socket.emit('draw-segment',data);
    }


    broadcastMessage(message:{
        roomId:string, 
        username:string, 
        isNotification:boolean, 
        message:string
    }):void{
        this.socket.emit('broadcast-message',(message));
    }


    signalNextTurn():void{
        this.playerTurn = false;
        this.playerTurn$.next(false);
        this.socket.emit("next-turn", this.roomId);
    }



    /*
    * Update the options of the game for the rest of the players to see.
    */
    private updateGameOptions(data:OptionsUpdate):void{
        this.gameOptions = data;
        this.gameOptions$.next(data);
    }


    /*Called when user joins a room, loads game info into client*/
    private unpack({started,config, userList, roomId}){
        this.players = userList;
        this.roomId = roomId;
        this.gameStarted = started;
        this.gameOptions = config;
        
        this.players$.next(userList);
        this.gameStarted$.next(started);
    }


    /*
    * Getters and setters for the host and username class fields.
    */
    get isHost():boolean {return this._isHost}
    set isHost(isHost:boolean) {this._isHost = isHost}
    get username():string{return this._username};
    set username(username:string){this._username = username}
}
