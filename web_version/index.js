
import { BSON } from './lib/bson.mjs';
const WANTED_RATIO = 3;
const WANTED_MINIMUM_NET_GAIN = 100000;
const AT_LEAST_X_SALES = 5;
const IN_THE_LAST_X_DAYS = 3; // max = 30

const MS_IN_A_DAY = 86400000

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
    const response = await fetch(`https://universalis.app/api/v2/402/${item}?hq=${hq}&entries=30`);
    const json = await response.json();
    return json;
}

const getInfoFromLight = async (item, hq) => {
    const response = await fetch(`https://universalis.app/api/v2/light/${item}?hq=${hq}`);
    const json = await response.json();
    return json.listings[0];
}


ws.addEventListener('open', () => {
  worlds.forEach((value,key) => {
    ws.send(BSON.serialize({ event: 'subscribe', channel: `listings/add{world=${key}}` }));
  });
  console.log('Connection opened.');
});

const getNumberOfSalesInTheLastXDays = (recentHistory, hq) => {
    const filteredWithDates = recentHistory
    .filter(history => history.hq == hq)
    .filter(history => {
        return history.timestamp * 1000 > Date.now() - (MS_IN_A_DAY * IN_THE_LAST_X_DAYS);
    });

    const averagePrice = filteredWithDates.map(history => history.pricePerUnit).reduce((a, b) => a + b, 0) / filteredWithDates.length;
    return { number: filteredWithDates.length, averagePrice }
};

ws.addEventListener('close', () => console.log('Connection closed.'));

ws.addEventListener('message', async data => {
    const message = BSON.deserialize(await data.data.arrayBuffer());
    const [listing, ...rest] = message.listings;
    const { item, world } = message;
    const alphaInfos = await getInfoFromAlpha(item, listing.hq);
    const alphaPrice = alphaInfos.listings[0]?.pricePerUnit
    const ratio =  alphaPrice / listing.pricePerUnit;
    const theoricalNetGain = alphaPrice * listing.quantity - listing.pricePerUnit * listing.quantity
    const sales = getNumberOfSalesInTheLastXDays(alphaInfos.recentHistory, listing.hq);
    if(ratio > WANTED_RATIO && theoricalNetGain > WANTED_MINIMUM_NET_GAIN && sales.number >= AT_LEAST_X_SALES) {
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
                theoricalNetGain: newTheoricalNetGain,
                numberOfSales: sales.number,
                averagePriceOfSales: sales.averagePrice.toFixed(0),
                inLastXDays: IN_THE_LAST_X_DAYS
            });
    }
});