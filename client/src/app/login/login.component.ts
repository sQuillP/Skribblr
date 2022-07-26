import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SocketService } from '../services/socket.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  username:string = null;

  loginError:boolean = false;

  loginForm:FormGroup;

  clientId:string = null;

  subscription:Subscription;

  constructor(private router:Router, private server:SocketService) { }


  ngOnInit(): void {

    this.clientId = this.server.clientId;
    this.subscription = this.server.clientId$.subscribe((id:string)=> {
      this.clientId = id;
      console.log('retrieved id:',id)
    })

    this.loginForm = new FormGroup({
      'username': new FormControl(null,[Validators.required,validateName]),
      'roomId': new FormControl(null)
    })

  }


  onCreateNewGame():void{
    if(!this.clientId){
      alert('It appears you are not connected to our server. Please check your internet connection and try again.');
      // return;
    }

    const roomId:string = this.loginForm
    .get('username').value
    .replace(/\s+/gi,"_") +"-"+this.clientId;

    this.server.initUser(this.loginForm.get('username').value, true);
    this.router.navigate(['play',roomId])
  }


  onJoinRandomGame():void{
    this.server.initUser(this.loginForm.get('username').value, false);
    this.router.navigate(['play','']);
  }


  onJoinGameById():void{
    this.server.initUser(this.loginForm.get('username').value, false);
    this.router.navigate(['play', this.loginForm.get('roomId').value]);
  }

}

function validateName(control:AbstractControl):{[key:string]:boolean} | null{
  if(/^\s+/gi.test(control.value))
    return {"invalidName":true};
  return null;
}
