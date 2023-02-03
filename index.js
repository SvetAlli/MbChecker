import { serialize, deserialize } from 'bson';
import WebSocket from 'ws';
import fetch from 'node-fetch';


const WANTED_RATIO = 2;
const WANTED_MINIMUM_NET_GAIN = 50000;

const worlds = new Map();
worlds.set(33, 'Twintania');
worlds.set(36, 'Lich');
worlds.set(42, 'Zodiark');
worlds.set(56, 'Phoenix');
worlds.set(66, 'Odin');
worlds.set(67, 'Shiva');
worlds.set(403, 'Raiden');


const addr = 'wss://universalis.app/api/ws';

const ws = new WebSocket(addr);



const getInfoFromAlpha = async (item, hq) => {
    const response = await fetch(`https://universalis.app/api/v2/402/${item}?hq=${hq}`);
    const json = await response.json();
    return json.listings[0]?.pricePerUnit;
}

const getInfoFromLight = async (item, hq) => {
    const response = await fetch(`https://universalis.app/api/v2/light/${item}?hq=${hq}`);
    const json = await response.json();
    return json.listings[0];
}


ws.on('open', () => {
  worlds.forEach((value,key) => {
    ws.send(serialize({ event: 'subscribe', channel: `listings/add{world=${key}}` }));
  });
  console.log('Connection opened.');
});

ws.on('close', () => console.log('Connection closed.'));

ws.on('message', async data => {
    const message = deserialize(data);
    const [listing, ...rest] = message.listings;
    const { item, world } = message;
    const alphaPrice = await getInfoFromAlpha(item, listing.hq);
    const ratio =  alphaPrice / listing.pricePerUnit;
    const theoricalNetGain = alphaPrice * listing.quantity - listing.pricePerUnit * listing.quantity
    if(ratio > WANTED_RATIO & theoricalNetGain > WANTED_MINIMUM_NET_GAIN) {
        const newInfo = await getInfoFromLight(item, listing.hq);
        const newRatio =  alphaPrice / newInfo.pricePerUnit;
        const newTheoricalNetGain = alphaPrice * newInfo.quantity - newInfo.pricePerUnit * newInfo.quantity
        const response = await fetch(`https://xivapi.com/item/${item}`, { mode: 'cors' });
        const json = await response.json();
        console.log(
            { 
                name: json.Name_en,
                world: newInfo.worldName,
                hq: listing.hq,
                pricePerUnit: newInfo.pricePerUnit,
                totalPrice: newInfo.pricePerUnit * newInfo.quantity,
                alphaPrice,
                ratio: newRatio.toFixed(2),
                theoricalNetGain: newTheoricalNetGain
            });
    }
});