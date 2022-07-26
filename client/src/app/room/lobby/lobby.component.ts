import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { BiDirectionalMap } from 'src/app/models/BiDirectionalMap';
import { OptionsUpdate } from 'src/app/models/GameResources';
import { SocketService } from 'src/app/services/socket.service';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css']
})
export class LobbyComponent implements OnInit {

  @Input('images') images:string[];

  // map<playerId:string, image:string>
  selectedImages = new BiDirectionalMap<string,string>();

  isHost:boolean = false;
  players:any[];
  gameSetup:FormGroup;

  invalidSetup:boolean = true;

  constructor(private server:SocketService) { 
    this.isHost = this.server.isHost;
  }

  ngOnInit(): void {
    this.players = this.server.players;
    this.mapPlayersToCharacters();

    this.server.players$.subscribe(players => {
      this.players = players;
      this.mapPlayersToCharacters();
    });

    this.gameSetup = new FormGroup({
      "rounds": new FormControl({value:'3', disabled: !this.isHost},[Validators.required,this.limitRounds.bind(this)]),
      "timer": new FormControl({value: '45', disabled: !this.isHost},[Validators.required,this.limitTimer.bind(this)]),
      "customWords": new FormControl({value: '', disabled: !this.isHost})
    });

    this.server.gameOptions$.subscribe((options:OptionsUpdate) => {
      this.gameSetup.setValue({
        'rounds':options.rounds,
        'timer':options.timer,
        'customWords':options.customWords
      });
    });

      this.gameSetup.setValue({
        'rounds':this.server.gameOptions.rounds,
        'timer': this.server.gameOptions.timer,
        'customWords':this.server.gameOptions.customWords
      })
  }



  onSelectImage(image:string){
    if(!this.selectedImages.rev_has(image.substring(10)))
      this.server.selectPlayerImage(image);
  }


  displayPlayerImage(image:string):string{
    if(!image)
      return "../assets/unknown.png";
    return image;
  }


  // Form control values
  limitTimer(control:AbstractControl): {[key:string]:boolean} | null{
    if(control.value < 30 || control.value > 500)
      return {'invalidTime':true};
    return null;
  }

  
  limitRounds(control:AbstractControl):{[key:string]:boolean} | null {
    if(control.value < 1 || control.value > 10)
      return {'invalidRound':true};

    return null;
  }

  /*Get the indices of the already chosen images whenever a player */
  private mapPlayersToCharacters():void{
    this.players.forEach(player=> {
      if(!player.image) return;
      this.selectedImages.set(player.id, player.image.substring(10));
  });
  }

  private sanitizeCustomWords(words:string):string[]{
    return words
    .replace(/\s+\,+|\,+\s+|\s+|\,+/gi,' ')
    .trim()
    .split(' ');
  }

  onKeyPressUpdate():void{
    this.onUpdateGameOptions();
  }

  onUpdateGameOptions():void{
    const timer:number = (+this.gameSetup.get('timer').value);
    const rounds:number = (+this.gameSetup.get('rounds').value);
    let customWords:any = this.gameSetup.get('customWords').value;

    if(timer < 30 || timer > 500 || rounds < 1 || rounds > 10) return;

    console.log(typeof customWords)
    customWords = this.sanitizeCustomWords(customWords);

    const gameConfig:OptionsUpdate = {
      'rounds': rounds,
      'timer': timer,
      'customWords': customWords
    };

    // Append the room id for the server
    gameConfig.roomId = this.server.roomId;
    
    this.server.updateGameSettings(gameConfig);
  }

  onGameStart():void{
    this.onUpdateGameOptions();
    this.server.startGame();
  }

}
