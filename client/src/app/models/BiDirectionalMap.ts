

/*
* Injective map class allows for users to map a unique 1-1 correspondence,
* being able to get the key and value of a hashmap by using one or the other.
* 
* If one wishes to access the map using value, use 
* the methods with the prefix: "rev_"
*/

export class BiDirectionalMap<A,B> {

    private map:Map<A,B>;
    private rev_map:Map<B,A>;

    
    constructor(){
        this.map = new Map<A,B>();
        this.rev_map = new Map<B,A>();
    }

    /*Original key and value are stored as well as the reversed.*/
    set(key:A, value:B):void{
        if(this.map.has(key)){
            for(const [_entry, _key] of this.rev_map.entries()){
                if(this.rev_map.get(_entry) === key){
                    this.rev_map.delete(_entry);
                    this.rev_map.set(value,key);
                    this.map.set(key,value);
                    return;
                }
            }
        }
        this.map.set(key,value);
        this.rev_map.set(value,key);
    }

    /*get value from passing in key*/
    get(key:A):B {
        return this.map.get(key);
    }

    /*Get the key from passing in value*/
    rev_get(value:B):A{
        return this.rev_map.get(value);
    }

    /*true if key exists in InjectiveMap*/
    has(key:A):boolean{
        return this.map.has(key);
    }

    /* Return true if the value exists in the InjectiveMap*/
    rev_has(value:B):boolean{
        return this.rev_map.has(value);
    }

    /*entries list indexed as [key,value]*/
    entries():IterableIterator<[A,B]> {
        return this.map.entries();
    }

    /*reversed entries list indexed as [value,key]*/
    rev_entries():IterableIterator<[B,A]> {
        return this.rev_map.entries();
    }
    
    debug():void{
        console.log(this.map, this.rev_map);
    }
}