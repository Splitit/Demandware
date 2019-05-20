'use strict';

/* API includes */
var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var SplititService = require('/int_splitit/cartridge/scripts/payment/service/SplititService.ds');

/* Script Modules */
var controllersPath = Resource.msg('path.storefront.controllers', 'splitit', null);
var corePath = Resource.msg('path.storefront.core', 'splitit', null);
var app = require(controllersPath + '/cartridge/scripts/app');
var Cart = require(controllersPath + '/cartridge/scripts/models/CartModel');

/**
 * Verifies a credit card against a valid card number and expiration date and possibly invalidates invalid form fields.
 * If the verification was successful a credit card payment instrument is created.
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);
    var creditCardForm = app.getForm('billing.paymentMethods.creditCardSplitit');
    var paymentMethodsForm = app.getForm('billing.paymentMethods');
    var PaymentMgr = require('dw/order/PaymentMgr');

    var cardNumber = creditCardForm.get('number').value();
    var cardSecurityCode = creditCardForm.get('cvn').value();
    var cardType = creditCardForm.get('type').value();
    var expirationMonth = creditCardForm.get('expiration.month').value();
    var expirationYear = creditCardForm.get('expiration.year').value();
    var numberOfInstallments = paymentMethodsForm.get('numberOfInstallments').value();
    var paymentCard = PaymentMgr.getPaymentCard(cardType);

    var creditCardStatus = paymentCard.verify(expirationMonth, expirationYear, cardNumber, cardSecurityCode);

    if (creditCardStatus.error) {

        var invalidatePaymentCardFormElements = require(corePath + '/cartridge/scripts/checkout/InvalidatePaymentCardFormElements');
        invalidatePaymentCardFormElements.invalidatePaymentCardForm(creditCardStatus, session.forms.billing.paymentMethods.creditCardSplitit);

        return {error: true};
    }

    Transaction.wrap(function () {
        cart.removeExistingPaymentInstruments('SPLITIT');
        var paymentInstrument = cart.createPaymentInstrument('SPLITIT', cart.getNonGiftCertificateAmount());

        paymentInstrument.creditCardHolder = creditCardForm.get('owner').value();
        paymentInstrument.creditCardNumber = cardNumber;
        paymentInstrument.creditCardType = cardType;
        paymentInstrument.creditCardExpirationMonth = expirationMonth;
        paymentInstrument.creditCardExpirationYear = expirationYear;
        paymentInstrument.custom.splitit_NumberOfInstallments = numberOfInstallments;
    });

    // Calling the splitit login service
    var result = SplititService.call({
        operation: 'Login'
    });


    if (result.object.error) {
        return result.object;
    }

    // Store this in the session
    session.privacy.splititSessionId = result.object.sessionId;

    // Calling the splitit initiate service
    var result = SplititService.call({
        operation: 'Initiate',
        cart: cart
    });

    return result.object;
}

/**
 * Authorizes a payment using a credit card. The payment is authorized by using the SPLITIT processor
 * only and setting the order no as the transaction ID. Customizations may use other processors and custom
 * logic to authorize credit card payment.
 */
function Authorize(args) {
    var orderNo = args.OrderNo;
    var paymentInstrument = args.PaymentInstrument;
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

    // Calling the splitit create service
    var result = SplititService.call({
        operation: 'Create',
        orderNo: orderNo
    });

    if (result.object.error) {
        return result.object;
    }

    var installmentPlanNumber = result.object.installmentPlanNumber;
    var status = result.object.status;

    var order = OrderMgr.getOrder(orderNo);
    var paymentAction = Site.current.preferences.custom.splitit_PaymentAction;

    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.transactionID = orderNo;
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        paymentInstrument.paymentTransaction.custom.installmentPlanNumber = installmentPlanNumber;

        if(order && (paymentAction.value == "authorize_capture")) {
        	order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
        }
    });

    // Calling the splitit update plan service to update the order reference sanity check
    var result = SplititService.call({
        operation: 'UpdatePlan',
        orderNo: orderNo,
        installmentPlanNumber: installmentPlanNumber
    });

    if (result.object.error) {
        return result.object;
    }

    return true;
}

/*
 * Module exports
 */
exports.Handle = Handle;
exports.Authorize = Authorize;

