'use strict';

const MQTT = require('async-mqtt');
const NefitEasyClient = require('nefit-easy-commands');
const Promise = require("bluebird");

const DELAY = 300000;
const PUBLISH_TO_SEPERATE_TOPICS = process.env.PUBLISH_TO_SEPERATE_TOPICS !== undefined ? process.env.PUBLISH_TO_SEPERATE_TOPICS : false;

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
            if (PUBLISH_TO_SEPERATE_TOPICS) {
                await mqtt.publish(topic+'/mode', status['user mode'].toString());
                await mqtt.publish(topic+'/setpoint', status['temp setpoint'].toString());
                await mqtt.publish(topic+'/inhouse', status['in house temp'].toString());
                await mqtt.publish(topic+'/outdoor_temp', status['outdoor temp'].toString());
                await mqtt.publish(topic+'/override_setpoint', status['temp override temp setpoint'].toString());
                await mqtt.publish(topic+'/manual_setpoint',  status['temp manual setpoint'].toString());
                await mqtt.publish(topic+'/hot_water_active', status['hot water active']? '1' :'0');
                await mqtt.publish(topic+'/serial', params.serialNumber.toString());
                await mqtt.publish(topic+'/pressure', pressure.pressure.toString());
                await mqtt.publish(topic+'/supply_temperature', supplyTemperature.temperature.toString());
            } else {
                let message = {
                    'mode' : status['user mode'],
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
                await mqtt.publish(topic, JSON.stringify(message));
            }
            })
        .delay(DELAY).then(() => publishStatus(nefitClient, mqtt));
}

async function handleMessage(nefitClient, topic, message){
    if(topic.endsWith("settemperature")){
        return await nefitClient.setTemperature(message.toString());
    }
    if(topic.endsWith("setmode") && (message == "manual" || message == "clock")) {
        return await nefitClient.setUserMode(message.toString())
    }
    console.log("unsupported message on topic " + topic +": "+message)
}

Promise.using(nefitClient.connect(), mqttClientP, 
    async (_, mqttClient) => {
        console.log("Connected...");
        await mqttClient.subscribe("/nefit/".concat(params.serialNumber).concat("/command/+"))
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
