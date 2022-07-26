

export interface Player {
    username:string,
    isHost:boolean,
    points: number,
    correctlyGuessed:boolean,
    roomId?:string,
    image:string,
    id:string
};

export interface ImageUpdate {
    image:string, 
    id:string, 
    roomId:string
};

export interface OptionsUpdate {
    roomId?:string, 
    rounds:number, 
    timer:number, 
    customWords:string[]
};

export interface DrawData{
    prevX:number,
    prevY:number,
    currentX:number,
    currentY:number,
}

// export interface