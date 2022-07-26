import { Injectable } from "@angular/core";
import { ActivatedRoute, ActivatedRouteSnapshot, CanActivate, Params, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable, Subscription } from "rxjs";
import { SocketService } from "../services/socket.service";


/*
* AuthGuard is responsible for joining the user to 
* a lobby based on the settings they created
*/


@Injectable({providedIn:'root'})
export class RoomGuard implements CanActivate{

    roomIdSubscription:Subscription;
    roomJoinSubscription:Subscription;
    private id:string = null;


    constructor(private router:Router,
         private server:SocketService,
         private route:ActivatedRoute
         )
        {
            this.id = this.server.clientId;
            this.roomIdSubscription = this.server.clientId$.subscribe((id:string)=> {
                this.id = id;
            });
    }


    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
        
        if(!this.id ){
            this.router.navigate(['login']);
            return false;
        }

        if(!route.params['roomId'])
            return this.server.joinRandomRoom();

        if(!this.server.isHost)
            return this.server.joinRoom(route.params['roomId']);
        
        return this.server.createRoom(route.params['roomId']);
    }
}