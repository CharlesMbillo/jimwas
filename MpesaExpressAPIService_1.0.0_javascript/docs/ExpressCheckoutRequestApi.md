# MpesaExpressApiService.ExpressCheckoutRequestApi

All URIs are relative to *https://virtserver.swaggerhub.com*

Method | HTTP request | Description
------------- | ------------- | -------------
[**stkpushPost**](ExpressCheckoutRequestApi.md#stkpushPost) | **POST** /stkpush | 



## stkpushPost

> STKPushResponse stkpushPost(routeCode, operation, messageId, sTKPushRequest, opts)



### Example

```javascript
import MpesaExpressApiService from 'mpesa_express_api_service';
let defaultClient = MpesaExpressApiService.ApiClient.instance;
// Configure OAuth2 access token for authorization: default
let default = defaultClient.authentications['default'];
default.accessToken = 'YOUR ACCESS TOKEN';

let apiInstance = new MpesaExpressApiService.ExpressCheckoutRequestApi();
let routeCode = 207; // String | 
let operation = STKPush; // String | 
let messageId = 232323_KCBOrg_8875661561; // String | 
let sTKPushRequest = new MpesaExpressApiService.STKPushRequest(); // STKPushRequest | Express Checkout Request Body
let opts = {
  'accessControlAllowOrigin': * // String | 
};
apiInstance.stkpushPost(routeCode, operation, messageId, sTKPushRequest, opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **routeCode** | **String**|  | 
 **operation** | **String**|  | 
 **messageId** | **String**|  | 
 **sTKPushRequest** | [**STKPushRequest**](STKPushRequest.md)| Express Checkout Request Body | 
 **accessControlAllowOrigin** | **String**|  | [optional] 

### Return type

[**STKPushResponse**](STKPushResponse.md)

### Authorization

[default](../README.md#default)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

