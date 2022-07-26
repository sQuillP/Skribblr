

/* 
* Keep a hashmap of all rooms and their users 
* Type: 
* ---Deprecated: Map<roomId:string, userList: Array<{username:string, userId:string}>>
*
* Current configuration:
* Map<roomId:string, {
* config:{rounds:number, timer:number, customWords:string[]},
* userList: Array<{username:string, userId:string}}>
* } >
*/
const rooms = new Map();


/*
* Keep a list of all active in-game users and the lobbies they are in
* id = player id
* Type: Map<id:string,roomId:string>
*/
const global_users = new Map();


/*
* Define the maximum capacity for the number of players in a server
*/
const MAX_ROOM_CAPACITY = 12;


const io = require('socket.io')(3001,{
    cors:{
        origin: ["http://localhost:4200"]
    }
});

const fs = require('fs')



let dictionary = null;

/*Populate the dictionary array when the server starts*/
 (()=>{
    fs.readFile('public/nouns.txt','utf-8',(error,data)=>{
        if(error) return;
        dictionary = data.split('\n');
        console.log('loaded dictionary');
    });
})();


io.on('connection', (socket)=> {
    
    /* Deliver the client id to the user. */
    socket.emit('deliver_client_id',socket.id);


    /*
    * user = {username:string, isHost:boolean, id:string, roomId:string}
    */
    socket.on('create-room',(user, status)=> {
        if(!user){
            console.error('cannot create room with user',socket.rooms);
            status(false,null); 
            return;
        }
        console.log('creating room');

        const gameData = {
            config:{ timer: 30, rounds:3, currentRound: 1, customWords:''},
            word: '',
            currentTurn: 0,
            started:false,
            correctlyGuessed:[],
            userList: [user]
        };

        rooms.set(user.roomId,gameData);
        global_users.set(user.id,user.roomId);
        socket.join(user.roomId);
        socket.to(user.roomId).emit('update-user-list',rooms.get(user.roomId));
        status(true,rooms.get(user.roomId));
    });


    /*
    * user = {username:string, image:string, isHost:boolean,  id: string, roomId:string}
    */
    socket.on('join-room',(user,status) => {
        console.log(user);
        if(socket.rooms.has(user.roomId)||!rooms.has(user.roomId)){
            status(false,null);
            return;
        }
        console.log('joining room: '+user.roomId);

        rooms.get(user.roomId).userList.push(user);
        global_users.set(user.id,user.roomId)
        socket.join(user.roomId);
        
        socket.to(user.roomId).emit('update-user-list',rooms.get(user.roomId));
        status(true,rooms.get(user.roomId));
    });


    /*
    * user = {username:string, isHost:boolean, id:string};
    */
    socket.on('join-random-room',({ points, correctlyGuessed, image, roomId,   username, isHost, id},status)=> {

        for(const [roomId, {config, userList} ] of rooms) {
            if(userList.length < MAX_ROOM_CAPACITY){
                console.log('joining random room: ',roomId);
                rooms.get(roomId).userList.push({username,isHost,id,points,correctlyGuessed,image,roomId});
                global_users.set(id, roomId);
                socket.join(roomId);
                socket.to(roomId).emit('update-user-list',rooms.get(roomId));
                status(true,roomId,rooms.get(roomId));
                return;
            }
        }
        console.log('unable to join random room for some reason')
        status(false,null,null);
    })



    /**
     * data = { image:string, id:string, roomId:string}
     */
    socket.on('choose-image',({id, image, roomId},status)=>{
        console.log('player choosing image')
        let playerList = rooms.get(roomId).userList;

        
        for(let i = 0; i<playerList.length; i++){
            if(playerList[i].id === id)
                playerList[i].image = image;
        }

        socket.to(roomId).emit("updated-image",playerList);
        status(playerList);
    })


    /*
    * data = {roomId:string rounds:number, timer:number, customWords:string[]}.
    */
    socket.on('update-game-settings',({rounds, timer, customWords, roomId})=> {
        const newGameConfig = {
            rounds:rounds,
            timer:timer,
            currentRound: 1,
            customWords:customWords.join(',')
        };

        rooms.get(roomId).config = newGameConfig;

        socket.to(roomId).emit('updated-game-options',newGameConfig);
    })
    


    /*Notify all users that the game has started and make host the starting player.*/
    /*Return an object {status:boolean, wordChoice:Array[3]}*/
    socket.on('notify-game-start',({roomId, started},status)=> {
        let wordChoices = [];
        for(let i = 0; i<3; i++){
            let index = Math.round(Math.random()*dictionary.length-1);
            wordChoices.push(
                dictionary[index].trim()
            );
        }

        socket.to(roomId).emit('game-start',started);
        status({playerTurn:true, wordChoices: wordChoices});
    })


    socket.on('selected-word',({choice, roomId})=> {
        rooms.get(roomId).word = choice;
        socket.to(roomId).emit('receive-word',choice);
    });


    socket.on('refresh-word-choices',()=>{
        let wordChoices = [];
        for(let i = 0; i<3; i++){
            let index = Math.round(Math.random()*dictionary.length-1);
            wordChoices.push(
                dictionary[index].trim()
            );
        }
        io.to(socket.id).emit('get-word-choices',wordChoices);
    })
    
    socket.on('server-start-clock',(roomId)=>{
        socket.to(roomId).emit('start-clock');
    })

    socket.on('broadcast-message',(data) => {

        let room = rooms.get(data.roomId);

        if(room.word.toLowerCase() === data.message.toLowerCase()){

            if(room.correctlyGuessed.indexOf(socket.id) !== -1) return;

            for(let i = 0 ; i<room.userList.length; i++){
                if(room.userList[i].id === socket.id){
                    room.userList[i].points += 1200-(room.correctlyGuessed.length*100);
                    room.correctlyGuessed.push(socket.id);
                    room.userList[i].correctlyGuessed = true;
                    if(room.correctlyGuessed.length === room.userList.length-1){
                        room.correctlyGuessed = [];
                        
                        for(let i = 0; i<room.userList.length; i++)
                            room.userList[i].correctlyGuessed =false;

                        // if(++room.config.round > room.config.rounds){
                        //     io.to(socket.id).emit('game-over');
                        //     socket.to(data.roomId).emit('game-over');
                        //     return;
                        // }
                        io.to(socket.id).emit('trigger-next-round');
                        socket.to(data.roomId).emit('trigger-next-round')
                    }
                    break;
                }
            }

            socket.to(data.roomId).emit('receive-message', {
                username:"@server",
                isNotification: true,
                message:data.username + " correctly guessed the word"
            });

            io.to(socket.id).emit('receive-message',{
                username: "@server",
                isNotification:true,
                message: "You correctly guessed the word"
            });
            socket.to(data.roomId).emit('update-user-list',room);
            io.to(socket.id).emit('update-user-list',room);
        }
        else {
            socket.to(data.roomId).emit('receive-message', data);
            io.to(socket.id).emit('receive-message', data);
        }
    });

    socket.on('draw-segment',(drawData)=> {
        socket.to(drawData.roomId).emit('receive-draw-segment',drawData);
    });



    socket.on('next-turn',(roomId)=> {
        let room = rooms.get(roomId);
        room.currentTurn = (room.currentTurn + 1) % room.userList.length;
        if(room.currentTurn === 0){
            room.config.currentRound++;
            socket.to(roomId).emit('update-round', room.config.currentRound);
            io.to(socket.id).emit('update-round', room.config.currentRound);
        }
        if(room.config.currentRound >= room.config.rounds){
            console.log('should be game over')
            socket.emit('game-over');
            io.to(socket.id).emit('game-over');
            return;
        }
        console.log(room.config);
        io.to(room.userList[room.currentTurn].id).emit('player-turn',true);
        socket.to(roomId).emit('receive-message',{
            username:"@server",
            isNotification: true,
            message: room.userList[room.currentTurn].username + " Is now choosing a word!"
        });
        
    })

    /*Make sure if the host leaves, promot someone else to host the game. */
    socket.on('disconnect',()=>{
        if(!global_users.has(socket.id)) return;
        let room = global_users.get(socket.id)
        let roomArr = rooms.get(room).userList;

        let removedIndex = findId(socket.id,roomArr);
        if(removedIndex === -1){
            console.error('unable to remove user from room on disconnect');
            return;
        }
        roomArr.splice(removedIndex,1);
        if(!roomArr.length)
            rooms.delete(room);
        console.log('removed '+socket.id+" from ",roomArr);

        socket.to(global_users.get(socket.id)).emit('update-user-list',rooms.get(room));


        global_users.delete(socket.id);
    });
    
});


function findId(id, array){
    for(let i = 0; i<array.length; i++){
        if(id === array[i].id)
            return i;
    }
    return -1;
}

