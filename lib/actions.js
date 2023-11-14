var Homebridges = require('./mapping/Homebridges.js').Homebridges;

var homebridge;
var opt;

module.exports = {
	sberDiscovery: sberDiscovery,
	sberStatus: sberStatus,
	sberCommands: sberCommands,
	sberInit: sberInit,
};

function sberInit(options, hb) {
	opt = options;
	homebridge = hb;
}

const hbdict = {
	'devices.types.switch': { 'id': 'model_switch', 'manufacturer': 'TJMC', 'model': 'Switch', 'category': 'relay', 'features': ['on_off'] },
	'relay': { 'id': 'model_relay', 'manufacturer': 'TJMC', 'model': 'Relay', 'category': 'relay', 'features': ['online', 'on_off'] },
	'ipc': { 'id': 'model_ipc', 'manufacturer': 'TJMC', 'model': 'IPC', 'category': 'ipc', 'features': ['online', 'on_off'] }
};

function hbToSberDevice(hbDevice) {
	return ({
		id: hbDevice.id,
		name: hbDevice.name,
		default_name: hbDevice.name,
		model: hbdict[hbDevice['type']] || {},
		model_id: ""
	});
}

/**
 * Sber Devices Discovery (init/period)
 * @param {*} message
 * @param {Function} callback
 */
function sberDiscovery(message, callback) {
	homebridge.HAPaccessories(function (endPoints) {
		var response;
		var hbDevices = new Homebridges(endPoints, this);
		response = hbDevices.getDevicesAndCapabilities(message);
		// debug("RESPONSE", JSON.stringify(response));
		if (response && response.payload.devices.length < 1) {
			opt.log.log("ERROR: HAP Discovery failed, please review config");
		} else {
			opt.log.log("sberDiscovery - returned %s devices", response.payload.devices.length);
		}
		if (1 == 1) {
      var dataNotifies = hbDevices.onNotifies();
      for (var i = 0; i < dataNotifies.length; i++) {
        registerNotifies(dataNotifies[i].deviceID, '{"characteristics":' + JSON.stringify(dataNotifies[i].characteristics) + '}')
      }
      for (var i = 0; i < response.payload.devices.length; i++) {
        var device_data = response.payload.devices[i];
        if (device_data.hasOwnProperty("capabilities"))
          for (var j = 0; j < device_data.capabilities.length; j++) device_data.capabilities[j].reportable = true;
        if (device_data.hasOwnProperty("properties"))
          for (var j = 0; j < device_data.properties.length; j++) device_data.properties[j].reportable = true;
      }
    }
		const devices = response['payload']['devices'].map(hbToSberDevice);
		opt.log.debug("Discovery Response", JSON.stringify(devices, null, 4));
		callback(null, { devices: devices });
	}.bind(this));
}

/**
 * Sber Devices Status request
 * @param {*} message
 * @param {Function} callback
 */
function sberStatus(message, callback) {
  var response = {
    devices : {}
  };

	try {
    if (message.devices.length == 0) {
      throw new Error('device array is empty');
		}
		homebridge.HAPaccessories(async function (endPoints) {
			var hbDevices = new Homebridges(endPoints, this);
			message.devices = message.devices.filter(Boolean);
			var devicesHBName = hbDevices.getDevicesHBName(message.devices, opt.log);
			var currentEndpoint = endPoints.find(function (endpoint) {
				// Compare endpoint homebridge name and current hb_name
				return devicesHBName.includes(endpoint.instance.name)
			});

			for (var i = 0; i < message.devices.length; i++) {
        var device_id = message.devices[i];
        var dev_status = hbDevices.checkThatDeviceExists(device_id);

        if (dev_status.error_code) {
          // debug(dev_status.error_message, device_data);
					Object.assign(response.devices, {
						[device_id]: {
							id: device_id,
							error_code: dev_status.error_code,
							error_message: dev_status.error_message
						}
					});
          continue;
				}

				let status = await dev_status.service.getDeviceState(homebridge, currentEndpoint.instance.deviceID);

				Object.assign(response.devices, {
					[device_id]: status
				});
			}

			opt.log.debug("Status Response", JSON.stringify(response, null, 4));

			callback(null, response);
		}.bind(this));

	} catch(e) {
    // probably JSON does not have those fields.
    opt.log.error("error with action JSON data", e.message);
    callback(e, {
      "payload": {
        "error_code": 400, // bad request data
        "error_message": e.message
      }
    });
  }


}

/**
 * Sber Devices Commands execute
 * @param {*} message
 * @param {Function} callback
 */
function sberCommands(message, callback) {
	opt.log.log(">>", JSON.stringify(message));

	var command_body = {
    "characteristics": []
  };

  var command_params = {};

	try {

		homebridge.HAPaccessories(function (endPoints) {
			var hbDevices = new Homebridges(endPoints, this);

			for ([device_id, device_data] of Object.entries(message.devices)) {
				var dev_status = hbDevices.checkThatDeviceExists(device_id);

				if (dev_status.error_code) {
					opt.log.error({
            id: device_id,
            error_code: dev_status.error_code,
            error_message: dev_status.error_message
          });
          continue;
				}

				if (device_data.states.length == 0) {
          throw new Error('device id ' + device_id + ' states array is empty');
				}

				for (device_state of device_data.states) {
					var cap_status_arr = dev_status.service.getCharacteristicIidAndValueFromCapability(device_state);
					opt.log.debug("Command Cap", JSON.stringify(cap_status_arr, null, 4));
					for (var k = 0; k < cap_status_arr.length; k++) {
            cap_status = cap_status_arr[k];
            command_body.characteristics.push({
              "aid": cap_status.aid,
              "iid": cap_status.iid,
              "value": cap_status.value
            });
          }
				}
			}

			var devicesHBName = hbDevices.getDevicesHBName(Object.keys(message.devices));
      var currentEndpoint = endPoints.find(function (endpoint) {
        // Compare endpoint homebridge name and current hb_name
        return devicesHBName.includes(endpoint.instance.name)
      })

      if (!currentEndpoint) {
        this.log("Cannot find the current endpoint")
        callback(null,response);
        return;
			}

			// opt.log.debug("Command currentEndpoint", JSON.stringify(currentEndpoint, null, 4));

			homebridge.HAPcontrolByDeviceID(currentEndpoint.instance.deviceID, JSON.stringify(command_body), function(err, status) {
        opt.log.log("Action", currentEndpoint.instance.deviceID, JSON.stringify(command_body), status, err);
      }.bind(this));

		}.bind(this));

	} catch(e) {
    // probably JSON does not have those fields.
    opt.log.error("error with action JSON data", e.message);
    callback(e, {
      "payload": {
        "error_code": 400, // bad request data
        "error_message": e.message
      }
    });
  }
}

function registerNotifies(deviceID, data) {
  homebridge.HAPeventByDeviceID(deviceID, data, function(err, status) {});
}

/**
 * Sending Event to Sber
 * @param {*} message
 * @param {*} callback
 */
function sberEvent(message, callback) {}