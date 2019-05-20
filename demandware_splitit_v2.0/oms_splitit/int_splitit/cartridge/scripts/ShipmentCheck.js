'use strict';

var Site = require('dw/system/Site');
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var SplititService = require('/int_splitit/cartridge/scripts/payment/service/SplititService.ds');

/**
 * Check if order is shipped and is paid using SPLITIT and then notify splitit to start installment
 * 
 * @hook dw.order.shippingorder.afterStatusChange
 * @param shipmentOrder
 * @returns shipmentOrder
 */
exports.ShipmentCheck = function(shipmentOrder) {
	var orderNo = shipmentOrder.orderNo;
	var order = OrderMgr.getOrder(orderNo);
	var paymentInstrument = order.paymentInstrument;
	var paymentProcessor = PaymentMgr.getPaymentMethod(
			paymentInstrument.getPaymentMethod()).getPaymentProcessor();
	
	Logger.debug('Splitit Shipment check');
	Logger.debug('Order No={0}',orderNo);
	Logger.debug('Shipping status={0}',order.getShippingStatus().value);
	Logger.debug('Payment processor={0}',paymentProcessor.ID);
	
	if (order.getShippingStatus().value == order.SHIPPING_STATUS_SHIPPED && paymentProcessor.ID == 'SPLITIT') {
		//var amount = paymentInstrument.paymentTransaction.amount.value;
		var installmentPlanNumber = paymentInstrument.paymentTransaction.custom.installmentPlanNumber;
		var paymentAction = Site.current.preferences.custom.splitit_PaymentAction;
		
		Logger.debug('installmentPlanNumber={0}',installmentPlanNumber);
		Logger.debug('paymentAction={0}',paymentAction);
		
		if (paymentAction.value == "authorize" && installmentPlanNumber) {

			/**
			 * Calling the splitit login service
			 */
			var result = SplititService.call({
				operation : 'Login'
			});
			
			if (result.object.error) {
				return result.object;
			}

			/**
			 * Store this in the session
			 */
			session.privacy.splititSessionId = result.object.sessionId;

			/**
			 * Calling the splitit start installment plan service to initiate payment on the order
			 */
			var result = SplititService.call({
				operation : 'Start',
				installmentPlanNumber : installmentPlanNumber
			});

			if (result.object.error) {
				return result.object;
			}
			
			order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
			
			Logger.debug('Order marked as paid');

		}
	}
	
	return shipmentOrder;
	// Logger.debug('1. Line Item with Tax Class and Tax Rate');

}