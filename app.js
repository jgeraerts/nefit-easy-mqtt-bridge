'use strict';

const MQTT = require('async-mqtt');
const NefitEasyClient = require('nefit-easy-commands');
const Promise = require("bluebird");

const DELAY = 300000;

function checkOption(option, error){
    if(!option){
        console.error(error);
        process.exit(1);
    }
}

let params = {
    serialNumber   : process.env.NEFIT_SERIAL_NUMBER,
    accessKey      : process.env.NEFIT_ACCESS_KEY,
    password       : process.env.NEFIT_PASSWORD,
    mqttUrl        : process.env.MQTT_URL,
    mqttUsername   : process.env.MQTT_USERNAME,
    mqttPassword   : process.env.MQTT_PASSWORD,
};

checkOption(params.serialNumber, "NEFIT_SERIAL_NUMBER not set");
checkOption(params.accessKey,    "NEFIT_ACCESS_KEY not set");
checkOption(params.password,     "NEFIT_PASSWORD not set");
checkOption(params.mqttUrl,      "MQTT_URL not set.");

const mqttClient = MQTT.connect(params.mqttUrl,
                     {"username": params.mqttUsername,
                      "password": params.mqttPassword})

const mqttClientP = new Promise(function(resolve,reject){
    mqttClient.on('connect', () => resolve(mqttClient));
    mqttClient.on('error', (error) => { reject(error); });
});

const nefitClient  = NefitEasyClient({
    serialNumber   : params.serialNumber,
    accessKey      : params.accessKey,
    password       : params.password
});

function publishStatus(nefitClient, mqtt){
    let promises = [nefitClient.status(),
                    nefitClient.pressure(),
                    nefitClient.supplyTemperature(),];
    return Promise.all(promises)
        .spread(async (status, pressure, supplyTemperature) => {
            let topic = "/nefit/".concat(params.serialNumber);
            let message = {
                'setpoint': status['temp setpoint'],
                'inhouse':  status['in house temp'],
                'outdoorTemp': status['outdoor temp'],
                'overrideSetpoint': status['temp override temp setpoint'],
                'manualSetpoint': status['temp manual setpoint'],
                'hotWaterActive': status['hot water active']? 1 :0,
                'serial' : params.serialNumber,
                'pressure': pressure.pressure,
                'supplyTemperature': supplyTemperature.temperature
            };
            await mqtt.publish(topic, JSON.stringify(message));})
        .delay(DELAY).then(() => publishStatus(nefitClient, mqtt));
}

async function handleMessage(nefitClient, topic, message){
    let value = parseFloat(message);
    await nefitClient.setTemperature(value);
}

Promise.using(nefitClient.connect(), mqttClientP, 
    async (_, mqttClient) => {
        console.log("Connected...");
        await mqttClient.subscribe("/nefit/".concat(params.serialNumber).concat("/command/settemperature"))
        mqttClient.on('message', function(topic, message){
            handleMessage(nefitClient, topic, message);
        });
        return publishStatus(nefitClient, mqttClient);
    })
    .catch((e) => {
        console.error('error', e)
    }).finally(async () => {
        nefitClient.end();
        await mqttClient.end();        
    });
