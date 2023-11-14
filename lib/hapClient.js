var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;
var Homebridges = require('./mapping/Homebridges.js').Homebridges;

var opt;

/**
 * @typedef HapClientOptions
 * @type {object}
 * @property {boolean} pin - hap pin
 * @property {boolean} debug - debug mode
 * @property {import('homebridge').Logger} log - logger
 *
 */


/**
 * HAP Discovery
 * @param {HapClientOptions} options
 */
function hapClient(options) {
	opt = options;
	this.options = options;

	this.homebridge = new HAPNodeJSClient({
		pin: options.pin,
		debug: options.debug ?? false,
	});
  // homebridge.on('Ready', function(accessories) {
	// 	options.eventBus.emit('hapReady');
  // });
  // homebridge.on('hapEvent', function(event) {
  //   // options.log.debug('>>hap event', event);
	// 	options.eventBus.emit('hapEvent', event);
	// });

}

module.exports = hapClient;