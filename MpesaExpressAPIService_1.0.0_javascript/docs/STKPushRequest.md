# MpesaExpressApiService.STKPushRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**phoneNumber** | **String** | The phone number sending money. The parameter expected is a Valid Safaricom Mobile Number that is M-PESA registered in the format 2547XXXXXXXX | 
**amount** | **String** | Decimal values are not permitted | 
**invoiceNumber** | **String** | This is an Alpha-Numeric parameter that is defined by your system as an Identifier of the transaction for CustomerPayBillOnline transaction type.Along with the business name, this value is also displayed to the customer in the STK Pin Prompt message. Maximum of 12 characters. | 
**sharedShortCode** | **Boolean** | If you set this parameter to true, Paramaters OrgShortCode, OrgPassKey will be replaced with internal values. | 
**orgShortCode** | **String** | The organization receiving the funds. The parameter expected is a 5 to 6 digit | 
**orgPassKey** | **String** | This is the password used for encrypting the request sent. | 
**callbackUrl** | **String** | A CallBack URL is a valid secure URL that is used to receive notifications from M-Pesa API. It is the endpoint to which the results will be sent by M-Pesa API. | 
**transactionDescription** | **String** | This is any additional information/comment that can be sent along with the request from your system. Maximum of 13 Characters. | 


