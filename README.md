# nefit-easy-mqtt-bridge

Bridge metrics from nefit/buderus/bosch backend to a mqtt topic 
 
# Usage
 
* install dependencies using `npm install` or build a docker image using the provided Dockerfile
* set the correct environment variables (see below)
* run `node app.js`
 
# Configuration
 
The app is configured using multiple environment variables:

    NEFIT_SERIAL_NUMBER 
    NEFIT_ACCESS_KEY
    NEFIT_PASSWORD
    MQTT_URL
    MQTT_USERNAME
    MQTT_PASSWORD
    PUBLISH_TO_SEPERATE_TOPICS

# Topics

The bridge posts a JSON message to the topic `/nefit/${serialnumber}` with following keys

* 'setpoint'
* 'inhouse'
* 'outdoorTemp'
* 'overrideSetpoint'
* 'manualSetpoint'
* 'hotwaterActive'
* 'serial'
* 'pressure'
* 'supplyTemperature'

example 
```
{
  "setpoint": 21.5,
  "inhouse": 21.7,
  "outdoorTemp": 7,
  "overrideSetpoint": 21.5,
  "manualSetpoint": 15,
  "hotWaterActive": 1,
  "serial": "1234567",
  "pressure": 25.5,
  "supplyTemperature": 47.3
}
```


   
# TODO

* Accept commands for setting the temperature
* Make the topic configurable
* Make the delay configurable
