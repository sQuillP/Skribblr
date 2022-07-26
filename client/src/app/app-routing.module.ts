import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RoomComponent } from './room/room.component';
import { RoomGuard } from './room/room.guard';

const routes: Routes = [
  {path: 'home', component: LoginComponent},
  {path:'play/:roomId', component:RoomComponent, canActivate: [RoomGuard]},

  {path:'**', redirectTo:'/home', pathMatch:'full'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
