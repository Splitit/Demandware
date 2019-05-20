'use strict';

var SplititService = require('/int_splitit/cartridge/scripts/payment/service/SplititService.ds');
var Logger = require('dw/system/Logger');

exports.ShipmentCheck = function(shipmentOrder){
	var orderNo = shipmentOrder.orderNo;
	var amount = shipmentOrder.paymentInstrument.paymentTransaction.amount.value;
	Logger.debug('1. Line Item with Tax Class and Tax Rate');
	
}