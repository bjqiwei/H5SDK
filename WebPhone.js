(function () {
    
    window.WebPhone = window.WebPhone || {
            _version: "2.0.8.37",
            _thisPath: "",

            callid: null,

            SessionS: {},
            userAgent: null,
            loglevel:"debug",
            
            STATUS:{
            // call states
            STATUS_NULL: 0,
            STATUS_CONSULTATIONING: 1,
            STATUS_RECONNECTING:2,
            STATUS_CONNECTED: 3,
            STATUS_ALTERNATEING:4,
            STATUS_CONFERENCEING:5,
            STATUS_SINGLESTEPCONFERENCEING:6
            },
            
            Cause:{
                Alternate:0,
                CallCancelled:1,
                CallNotAnswered:2,
                Consultation:3,
                MakeCall:4,
                NewCall:5,
                NormalClearing:6,
                SingleStepConference:7,
                Conference:8,
                SingleStepTransfer:9,
                Transfer:10
            },
            /**
            *设置日志级别
            * @param level:error,warn,info,debug
            **/
            setLogLevel:function(level)
            {
                WebPhone.debug("setLogLevel:"+level);
                if(level == "error" || level == "warn" || level == "info" || level == "debug"){
                    WebPhone.loglevel = level;
                    //SIP.setDebugLevel(WebPhone.loglevel);
                }
                else {
                    WebPhone.error("set log level error, not recognize:"+level);
                }
            },
            
            /**
             * 初始化
             * @param s_webrtc_type
             * @param s_fps
             * @param s_mbwu maxBandwidthUp (kbps)
             * @param s_mbwd maxBandwidthUp (kbps)
             * @param s_za ZeroArtifacts
             * @param s_ndb NativeDebug
             */
            Init: function () {
                WebPhone.debug("Init:");
                WebPhone.info("WebPhone version=" + WebPhone._version);
                
                if (typeof(SIP) == "undefined") {
                    WebPhone.error("SIP not init");
                    alert("SIP not init");
                    return;
                }

                WebPhone.info("init success");
            },
            
            /**
             * 注册
             * @param txtRealm
             * @param sipid
             * @param sipurl
             * @param pwd
             * @param txtDisplayName
             * @param txtWebsocketUrl
             * @param txtICEServer
             */
            Login: function (txtRealm, sipid, sipurl, pwd, txtDisplayName, txtWebsocketUrl, txtICEServer) {
                // catch exception for IE (DOM not ready)
                WebPhone.debug("Login,Realm:" + txtRealm + ",SipID:" + sipid + ",SipUrl:" + sipurl + ",Pwd:" + pwd + ",DisplayName:" + txtDisplayName + ",WebSocketUrl:" + txtWebsocketUrl + ",ICEServer:" + txtICEServer);

                WebPhone.userAgent = new SIP.UA({
                  uri: sipurl,
                  wsServers: txtWebsocketUrl,
                  authorizationUser: sipid,
                  password: pwd,
                  displayName: txtDisplayName,
                  replaces: SIP.C.supported.SUPPORTED,
                  traceSip: true,
                  //register: true,
                  autostart: false,
                  allowLegacyNotifications: true,
                  //hackIpInContact: true,
                  //hackViaTcp: true,
                  sessionDescriptionHandlerFactoryOptions: {
                      constraints: {
                            audio: true,
                            video: false
                      },
                      //iceCheckingTimeout: 15000,
                      peerConnectionOptions: {
                          rtcConfiguration:{
                              iceServers:eval(txtICEServer) || []
                          }
                      }
                  },
                  registerExpires: 300,
                  wsServerMaxReconnection: 1,
                  log:{
                      level:WebPhone.loglevel === 'info' ? 'log': WebPhone.loglevel
                  },
                  userAgentString: "Avaya html5_client"
                });  
                
                WebPhone.userAgent.on('connecting', function (args) {
                    WebPhone.debug('connecting attempts:' + args.attempts);
                });
                
                WebPhone.userAgent.on('connected', function () {
                    WebPhone.debug('connected');
                });
                
                WebPhone.userAgent.on('disconnected', function(args){
                    var msg = {};
                    args = args || {};
                    args.transport = args.transport || {};
                    msg.reason = args.code?args.code:args.transport.lastTransportError.code;
                    msg.msg = args.transport.lastTransportError.reason ? args.transport.lastTransportError.reason:"WebSocket connection error";
                    WebPhone.debug("disconnected:" + JSON.stringify(msg));
                    if(WebPhone.userAgent != null && WebPhone.userAgent.status === SIP.UA.C.STATUS_STARTING){
                        WebPhone.error("登录失败:" + JSON.stringify(msg));
                        if (typeof(WebPhone.onConnectError) == "function") {
                            WebPhone.onConnectError(msg);
                        }
                        
                        WebPhone.userAgent.stop();
                        WebPhone.userAgent = null;
                    }
                    
                });
                
                WebPhone.userAgent.on('registered', function(args){
                    
                    if(WebPhone.userAgent.IsRegeisted === true){
                        return;
                    }
                    
                    WebPhone.userAgent.IsRegeisted = true;
                    
                    WebPhone.debug("registered:");
                    WebPhone.debug("登录成功");
                    if(typeof(WebPhone.onConnected) == "function"){
                        WebPhone.onConnected();
                    }
                });
                
                WebPhone.userAgent.on('unregistered', function(response,cause){

                    var msg = {};
                    response = response || {};
                    msg.reason = response.status_code ? response.status_code:504;
                    msg.msg = response.reason_phrase?response.reason_phrase:cause;
                    WebPhone.debug("unregistered:" + JSON.stringify(msg));
                    if (WebPhone.userAgent != null){
                        if(WebPhone.userAgent.status === SIP.UA.C.STATUS_READY){
                            WebPhone.info("登录失败:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onConnectError) == "function") {
                                WebPhone.onConnectError(msg);
                            }
                        }
                        else{
                            WebPhone.info("登出成功");
                            if (typeof(WebPhone.onLogout) == "function") {
                                WebPhone.onLogout();
                            }
                        }
                    }
                    WebPhone.userAgent.stop();
                    WebPhone.userAgent = null;
                });
                
                WebPhone.userAgent.on('registrationFailed', function (response, cause) {
                    var msg = {};
                    response = response || {};
                    msg.reason = response.status_code? response.status_code:404;
                    msg.msg = response.reason_phrase?response.reason_phrase:cause;
                    WebPhone.debug("registrationFailed:" + JSON.stringify(msg));
                    WebPhone.error("登录失败:" + JSON.stringify(msg));
                    if (typeof(WebPhone.onConnectError) == "function") {
                        WebPhone.onConnectError(msg);
                    }
                });
                
                WebPhone.userAgent.on('invite', function (session) {
                    var call_id = session.id.substr(0,session.id.indexOf(session.from_tag));
                    WebPhone.debug('invite:' + call_id);
                    WebPhone.SessionS[call_id] = session; 
                    WebPhone.callid = call_id;
                    WebPhone.bindEvent(session);
                    
                    var sRemoteNumber = session.remoteIdentity.uri.user || 'unknown';
                    var msg = {"callid": call_id, "caller": sRemoteNumber};
                    WebPhone.debug("onReceived:" + JSON.stringify(msg));
                    WebPhone.info("呼入号码为 [" + sRemoteNumber + "]");
                    if (typeof(WebPhone.onReceived) == "function") {
                        WebPhone.onReceived(msg);
                    }
                    
                });
                
                WebPhone.userAgent.on('message', function (message) {
                    WebPhone.debug("message:" + message.body);
                });
                
                WebPhone.userAgent.start();

            },
            // 注销
            Logout: function () {
                WebPhone.debug("Logout:");
                if (WebPhone.userAgent) {
                    WebPhone.userAgent.stop(); // shutdown all sessions
                }
                return 0;
            },
            /**
             * 获取版本号
             * @returns {string}
             */
            getVersion: function () {
                WebPhone.debug("getVersion:");
                return WebPhone._version;
            },
            
			onInfo:function(request) {
				var call_id = request.call_id;
				WebPhone.debug('info:' + call_id);
				var msg={callid:call_id};
				if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_SINGLESTEPCONFERENCEING){
                    WebPhone.SessionS[call_id]._status = WebPhone.STATUS.STATUS_CONNECTED;
                    msg.cause = WebPhone.Cause.SingleStepConference;
					var status_code = parseInt(request.body.substr(0,request.body.indexOf(':')));
					
					if(status_code === 200){
						WebPhone.debug("onConferenced:"+JSON.stringify(msg));
						if (typeof(WebPhone.onConferenced) == "function") {
							WebPhone.onConferenced(msg);
						}
						WebPhone.debug('单步会议中');
					}
					else{
						msg.reason = status_code;
						msg.msg = request.body.substr(request.body.indexOf(':')+1);
						WebPhone.debug("onConferenceFailed:"+JSON.stringify(msg));
						if (typeof(WebPhone.onConferenceFailed) == "function") {
							WebPhone.onConferenceFailed(msg);
						}
						WebPhone.debug('单步会议失败:' + msg.reason);
					}
				    return;
                }
			},

            //绑定事件
            bindEvent: function(session){
                session.on('progress', function (response,cause) {
                    //debugger;
                    WebPhone.debug('progress');
                    var msg = {callid: response.call_id,msg:cause};
                    WebPhone.callid = response.call_id;
                    if(WebPhone.SessionS[response.call_id]._status === WebPhone.STATUS.STATUS_CONSULTATIONING){
                        msg.cause = WebPhone.Cause.Consultation;
                    }
                    if(response.status_code == 100){
                        WebPhone.debug("onOriginated:" + JSON.stringify(msg));
                        WebPhone.info("外呼中...");
                        if (typeof(WebPhone.onOriginated) == "function") {
                            WebPhone.onOriginated(msg);
                        }
                    }
                    else if(response.status_code == 180 || response.status_code == 183){
                        
						if(response.status_code == 183){
							WebPhone.setupRemoteMedia(WebPhone.SessionS[WebPhone.callid]);
						}
						
                        WebPhone.debug("onDelivered:" + JSON.stringify(msg));
                        WebPhone.debug('远端振铃...');
                        if (typeof(WebPhone.onDelivered) == "function") {
                            WebPhone.onDelivered(msg);
                        }
                    }
                        
                });
                    
                session.on('accepted', function (data, cause) {
                    WebPhone.debug('accepted:');
                    WebPhone.callid = data.call_id || this.id.substr(0,this.id.indexOf(this.from_tag));
                    var msg = {"callid": WebPhone.callid,"msg":cause};
                    if(WebPhone.SessionS[WebPhone.callid]._status === WebPhone.STATUS.STATUS_CONSULTATIONING){
                        msg.cause = WebPhone.Cause.Consultation;
                    }

					WebPhone.setupRemoteMedia(WebPhone.SessionS[WebPhone.callid]);

                    WebPhone.debug("onEstablished:" + JSON.stringify(msg));
                    WebPhone.info("通话中");
                    if (typeof(WebPhone.onEstablished) == "function") {
                        WebPhone.onEstablished(msg);
                    }
                        
                });
                    
                session.on('rejected', function (response, cause) {
                    WebPhone.debug('rejected:' + cause);
                });
                
                session.on('failed', function (response, cause) {
                    WebPhone.debug('failed:'+cause);
                });
                    
                session.on('terminated', function(message, cause) {
                    WebPhone.debug('terminated:' + cause);
                    
                    var call_id = session.id.substr(0,session.id.indexOf(session.from_tag));
                    if(!WebPhone.SessionS[call_id]){
                        return;
                    }
                    WebPhone.callid = call_id;
                    message = message || {};
                    var msg = {"callid":call_id,"reason":message.status_code ? message.status_code:200,"msg":cause?cause:"OK"};

                    if(WebPhone.SessionS[WebPhone.callid]._status === WebPhone.STATUS.STATUS_CONSULTATIONING){
                        msg.cause = WebPhone.Cause.Consultation;
                    }

                    WebPhone.debug("onCallCleared:" + JSON.stringify(msg));
                    WebPhone.info("通话已挂断:" + msg.reason);
                    if(typeof(WebPhone.onCallCleared) == "function"){
                        WebPhone.onCallCleared(msg);
                    }

					!WebPhone.SessionS[call_id]._audio || document.body.removeChild(WebPhone.SessionS[call_id]._audio);
                    delete WebPhone.SessionS[call_id];
                });
                    
                session.on('cancel', function() {
                    WebPhone.debug('cancel');
                });
                
                session.on('reinvite', function(session) {
                    WebPhone.debug('reinvite');
                });

                session.on('hold', function (session,cause){
                    WebPhone.debug('hold');
                });
                    
                session.on('unhold',function(session,cause){
                    WebPhone.debug('unhold');
                });

                session.on('reinviteAccepted',function(session){
                    var call_id = session.id.substr(0,session.id.indexOf(session.from_tag));
                    var msg={callid:call_id};
                    WebPhone.callid = call_id;
                    WebPhone.debug('reinviteAccepted:' + JSON.stringify(msg));
					                        
                    if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_CONFERENCEING){
						WebPhone.SessionS[call_id]._status = WebPhone.STATUS.STATUS_CONNECTED;
                        msg.cause = WebPhone.Cause.Conference;
						 WebPhone.debug("onConferenced:"+JSON.stringify(msg));
                        if (typeof(WebPhone.onConferenced) == "function") {
                            WebPhone.onConferenced(msg);
                        }
                        WebPhone.debug('咨询会议中');
						return;
                    }

                    /*
					if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_SINGLESTEPCONFERENCEING){
                        WebPhone.SessionS[call_id]._status = WebPhone.STATUS.STATUS_CONNECTED;
                        msg.cause = WebPhone.Cause.SingleStepConference;
                        WebPhone.debug("onConferenced:"+JSON.stringify(msg));
                        if (typeof(WebPhone.onConferenced) == "function") {
                            WebPhone.onConferenced(msg);
                        }
                        WebPhone.debug('单步会议中');
						return;
                    }
					*/

                    if(this.local_hold === true){
                        
                        if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_CONSULTATIONING){
                            var result = WebPhone.MakeCall(WebPhone.SessionS[call_id]._consultNumber,WebPhone.SessionS[call_id]._userdata);
                            msg.newCall = result.callid;
                            msg.cause = WebPhone.Cause.Consultation;
                            WebPhone.SessionS[msg.newCall]._status = WebPhone.STATUS.STATUS_CONSULTATIONING;
                            WebPhone.SessionS[call_id]._newCall = result.callid;
                        }
                        
                        if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_ALTERNATEING){
                            msg.cause = WebPhone.Cause.Alternate;
                        }

                        WebPhone.debug("onHeld:"+JSON.stringify(msg));
                        if (typeof(WebPhone.onHeld) == "function") {
                            WebPhone.onHeld(msg);
                        }
                        WebPhone.debug('通话保持');
                    }
                    else if(this.local_hold === false){
                        
                        if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_RECONNECTING){
                            WebPhone.SessionS[call_id]._status = WebPhone.STATUS.STATUS_CONNECTED;
                            msg.cause = WebPhone.Cause.Consultation;
                        }
                        
                        if(WebPhone.SessionS[call_id]._status === WebPhone.STATUS.STATUS_ALTERNATEING){
                            WebPhone.SessionS[call_id]._status = WebPhone.STATUS.STATUS_CONNECTED;
                            msg.cause = WebPhone.Cause.Alternate;
                        }
                        WebPhone.debug("onRetrieved:" + JSON.stringify(msg));
                        if (typeof(WebPhone.onRetrieved) == "function") {
                            WebPhone.onRetrieved(msg);
                        }
                        WebPhone.debug('通话恢复');
                    }
                });
                    
                session.on('reinviteFailed',function(session){
                    var call_id = session.id.substr(0,session.id.indexOf(session.from_tag));
                    var msg={callid:call_id, reason:session.status_code || 504, msg:session.reason_phrase || "error"};
                    WebPhone.callid = call_id;
                    WebPhone.debug('reinviteFailed:' + JSON.stringify(msg));
                    if(this.local_hold === true){
                        WebPhone.debug("onHeldFailed:"+JSON.stringify(msg));
                        if (typeof(WebPhone.onHeldFailed) == "function") {
                            WebPhone.onHeldFailed(msg);
                        }
                        WebPhone.error('通话保持失败');
                    }
                    else if(this.local_hold === false){
                        WebPhone.debug("onRetrieveFailed:" + JSON.stringify(msg));
                        if (typeof(WebPhone.onRetrieveFailed) == "function") {
                            WebPhone.onRetrieveFailed(msg);
                        }
                        WebPhone.debug('通话恢复失败');
                    }
                });
                    
                session.on('replaced', function (newSession) {
                    WebPhone.debug('replaced');
                });
                    
                session.on('dtmf', function(request, dtmf) {
                    WebPhone.debug('dtmf');
                    var msg = {"callid": request.call_id,"dtmf":dtmf};
                    WebPhone.callid = request.call_id;
                    WebPhone.debug("onDtmfReceived:" + JSON.stringify(msg));
                    if (typeof(WebPhone.onDtmfReceived) == "function") {
                        WebPhone.onDtmfReceived(msg);
                    }
                });
                    
                session.on('bye', function(request) {
                    //debugger;
                    WebPhone.debug('bye:' + request.call_id);
                    var msg = {"callid":request.call_id,"reason":200,"msg":request.method};
                    WebPhone.callid = request.call_id;

					if(WebPhone.SessionS[request.call_id]._status === WebPhone.STATUS.STATUS_CONFERENCEING){
                        msg.cause = WebPhone.Cause.Conference;
                    }

                    WebPhone.debug("onCallCleared:" + JSON.stringify(msg));
                    WebPhone.info("通话已挂断:" + msg.reason);
                    
                    if(typeof(WebPhone.onCallCleared) == "function"){
                        WebPhone.onCallCleared(msg);
                    }

                    !WebPhone.SessionS[request.call_id]._audio || document.body.removeChild(WebPhone.SessionS[request.call_id]._audio);
                    delete WebPhone.SessionS[request.call_id];
                });
                    
                session.on('referRequested', function(context) {
                    WebPhone.debug('referRequested');
                });
                
                session.on('referRequestAccepted', function (referClientContext) {
                    WebPhone.debug('referRequestAccepted');
                });
                
                session.on('referRequestRejected', function (referClientContext) {
                    var call_id = referClientContext.call_id;
                    var msg = {callid:call_id,reason:referClientContext.status_code,msg:referClientContext.reason_phrase};
                    WebPhone.callid = referClientContext.call_id;
                    WebPhone.debug('referRequestRejected:' + JSON.stringify(msg));
                    WebPhone.debug("onTransferFailed:" + JSON.stringify(msg));
                    if (typeof(WebPhone.onTransferFailed) == "function") {
                        WebPhone.onTransferFailed(msg);
                    }
                    WebPhone.error('呼叫转接失败');
                });
                
                session.on('referProgress', function(referClientContext) {
                    WebPhone.debug('referProgress');
                });
                
                session.on('referAccepted', function (referClientContext) {
                    WebPhone.debug('referAccepted');
                });
                
                session.on('referRejected', function (referClientContext) {
                    var call_id = referClientContext.call_id;
                    var msg = {callid:call_id,reason:referClientContext.status_code,msg:referClientContext.reason_phrase};
                    WebPhone.callid = call_id;
                    WebPhone.debug('referRejected:' + JSON.stringify(msg));
                    WebPhone.debug("onTransferFailed:" + JSON.stringify(msg));
                    if (typeof(WebPhone.onTransferFailed) == "function") {
                        WebPhone.onTransferFailed(msg);
                    }
                    WebPhone.error('呼叫转接失败');
                });
                
                session.on('referInviteSent', function (referServerContext) {
                    WebPhone.debug('referInviteSent');
                });
                
                session.on('notify', function (request) {
                    var msg = {"callid": request.call_id};
                    WebPhone.callid = request.call_id;
                    WebPhone.debug('notify:' + JSON.stringify(msg));
                    WebPhone.debug("onTransferred:" + JSON.stringify(msg));
                    if (typeof(WebPhone.onTransferred) == "function") {
                        WebPhone.onTransferred(msg);
                        }
                    WebPhone.info('呼叫转接结束');
                });
                
                session.on('refer', function(context) {
                    var msg = {"callid": context.call_id};
                    WebPhone.callid = context.call_id;
                    WebPhone.debug('refer:' + JSON.stringify(msg));
                });
            },
            
            //呼叫
            MakeCall: function (called,userdata) {
                WebPhone.debug("MakeCall:" + called);
                var session = null;
                if (WebPhone.userAgent) {
                    // create call session
                    session = WebPhone.userAgent.invite(called, {sessionDescriptionHandlerOptions: {
                        constraints: {
                            audio: true,
                            video: false
                        }
                    },
					extraHeaders:[
						"P-User-to-User:" + (userdata ? typeof(userdata) === "string" ? userdata: JSON.stringify(userdata): "")
					],
					onInfo:WebPhone.onInfo,
					});
                    
                    if (session == null) {
                        
                        WebPhone.error('Failed to make call');
                        if (typeof(WebPhone.onMakeCallFailed) == "function") {
                            var msg = {};
                            msg.reason = 1;
                            msg.msg="make call failed";
                            WebPhone.onMakeCallFailed(msg);
                            WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
                            return {result:1};
                        }
                    }
                    
                    var call_id = session.id.substr(0,session.id.indexOf(session.from_tag));
                    WebPhone.debug("MakeCall:" + call_id);
                    WebPhone.bindEvent(session);

                    WebPhone.SessionS[call_id] = session;
                    WebPhone.callid = call_id;
                    return {result:0,callid:call_id};
                }
                else if (typeof(WebPhone.onMakeCallFailed) == "function") {
                    var msg = {};
                    msg.reason = 1;
                    msg.msg="未注册";
                    WebPhone.onMakeCallFailed(msg);
                    WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
                    return {result:1};
                }
                return {result:2};
            },
            //摘机
            AnswerCall: function (callid, userdata) {
                WebPhone.debug("AnswerCall:" + callid);
                if (callid && WebPhone.SessionS[callid]) {
                    WebPhone.debug('Connecting...');
                    WebPhone.SessionS[callid].accept({extraHeaders:[
						"P-User-to-User:" + (userdata ? typeof(userdata) === "string" ? userdata: JSON.stringify(userdata): "")
					],
					onInfo:WebPhone.onInfo
					});
                }
            },
            // 挂断 (SIP BYE or CANCEL)
            ClearCall: function (callid, reason) {
                WebPhone.debug("ClearCall, callid:" + callid + ",reason:" + reason);
                if (callid) {
                    WebPhone.debug('Terminating the call...'+callid);
                    
                    try{
                        WebPhone.SessionS[callid].terminate({status_code:reason});
                    }
                    catch(e) {
                        delete WebPhone.SessionS[callid];
                    };
                }
                else{
                    if(callid === null)
                        return;

                    WebPhone.debug('Terminating all call...');
                    var call_id;
                    for(call_id in WebPhone.SessionS){
                        WebPhone.debug('Terminating the call...'+call_id);
                        try {
                            WebPhone.SessionS[call_id].terminate({status_code:reason});
                        }
                        catch(e) {
                            delete WebPhone.SessionS[call_id];
                        };
                    }
                    
                }
                return 0;
            },
            //发送DTMF
            SendDTMF: function (callid, c) {
                var err = 1;
                if (callid && WebPhone.SessionS[callid] && c) {
                    err = WebPhone.SessionS[callid].dtmf(c);
                }
                WebPhone.debug("SendDTMF,callid:" + callid + ",c:" + c + ",result:" + err);
            },
            // 盲转
            SingleStepTransferCall: function (callid, s_destination, userdata) {
                WebPhone.debug("SingleStepTransferCall,callid:" + callid+ ",destination:" + s_destination);
                if (callid && WebPhone.SessionS[callid]) {
                    WebPhone.debug('SingleStepTransfering the call...'+callid);                    
                    var session = WebPhone.SessionS[callid].refer(s_destination,{extraHeaders:[
						"P-User-to-User:" + (userdata ? typeof(userdata) === "string" ? userdata: JSON.stringify(userdata): "")
					]});
                    return 0;
    
                }
                else{
                    WebPhone.error("SingleStepTransferCall, the call is not exist.");
                    return 1;
                }
            },
			
			// 咨询后转接
            TransferCall: function (heldCall, transferTargetCall) {
                WebPhone.debug("TransferCall,heldCall:" + heldCall+ ",transferTargetCall:" + transferTargetCall);
                if (heldCall && WebPhone.SessionS[heldCall] && transferTargetCall && WebPhone.SessionS[transferTargetCall]) {
                    WebPhone.debug('Transfering the call...');                    
                    var session = WebPhone.SessionS[heldCall].refer(WebPhone.SessionS[transferTargetCall]);
                    return 0;
    
                }
                else{
                    WebPhone.error("TransferCall, the call is not exist.");
                    return 1;
                }
            },
            /**
             * 保持
             * @param callid
             * @returns {number}
             * @constructor
             */
            HoldCall: function (callid) {
                WebPhone.debug("HoldCall,callid:" + callid);
                if (callid && WebPhone.SessionS[callid]) {
                    WebPhone.SessionS[callid].hold();
                    WebPhone.debug('Holding the call...'+callid);
                    return 0;
                } else {
                    WebPhone.error("HoldCall, the call is not exist.");
                    return 1;
                }
            },
            /**
             * 恢复
             * @param callid
             * @returns {number}
             * @constructor
             */
            RetrieveCall: function (callid) {
                WebPhone.debug("RetrieveCall,callid:" + callid);
                if (callid && WebPhone.SessionS[callid]) {
                    WebPhone.SessionS[callid].unhold();
                    WebPhone.debug('Retrieve the call...' + callid);                    
                    return 0;
                  
                } else {
                    WebPhone.error("RetrieveCall, the call is not exist.");
                    return 2;
                }
            },
            
            //咨询
            ConsultationCall:function(callid,called, userdata){
                WebPhone.debug("ConsultationCall,callid:" + callid + ",called:" + called);
                if (callid && WebPhone.SessionS[callid]) {
                    WebPhone.SessionS[callid]._status = WebPhone.STATUS.STATUS_CONSULTATIONING;
                    WebPhone.SessionS[callid]._consultNumber = called;
                    WebPhone.SessionS[callid]._userdata = userdata;
                    WebPhone.SessionS[callid].hold();
                    WebPhone.debug('hold the call...' + callid);
                    //WebPhone.MakeCall(called);                    
                    return 0;
                  
                } else {
                    WebPhone.error("ConsultationCall, the call is not exist.");
                    return 3;
                }
            },
            
            /**
             * 取消咨询
             * @param callid
             * @constructor
             */
            ReconnectCall: function (activeCall, heldCall) {
                WebPhone.debug("ReconnectCall,activeCall:" + activeCall+",heldCall:" + heldCall);
                if (heldCall && WebPhone.SessionS[heldCall]) {
                    WebPhone.SessionS[heldCall]._status = WebPhone.STATUS.STATUS_RECONNECTING;
                    WebPhone.debug('ReconnectCall the call...' + heldCall);                    
                    WebPhone.SessionS[heldCall].unhold();
                }
                else {
                    WebPhone.error("ReconnectCall, the call is not exist.");
                }

                WebPhone.ClearCall(activeCall);

            },
            
            //切换通话
            AlternateCall:function (activeCall,otherCall){
                WebPhone.debug("AlternateCall,activeCall:" + activeCall+",otherCall:" + otherCall);
                if (!activeCall || !WebPhone.SessionS[activeCall]){
                    WebPhone.error("AlternateCall, the activeCall is not exist.");
                    return 1;
                }
                
                if (!otherCall || !WebPhone.SessionS[otherCall]){
                    WebPhone.error("AlternateCall, the otherCall is not exist.");
                    return 1;
                }
                WebPhone.SessionS[activeCall]._status = WebPhone.STATUS.STATUS_ALTERNATEING;
                WebPhone.SessionS[otherCall]._status = WebPhone.STATUS.STATUS_ALTERNATEING;
                WebPhone.HoldCall(activeCall);
                WebPhone.RetrieveCall(otherCall);
            },
			
			//咨询后会议
            ConferenceCall:function (heldCall, otherCall){
                WebPhone.debug("ConferenceCall,otherCall:" + otherCall+",heldCall:" + heldCall);
                if (!heldCall || !WebPhone.SessionS[heldCall]){
                    WebPhone.error("ConferenceCall, the heldCall is not exist.");
                    return 1;
                }
                
                if (!otherCall || !WebPhone.SessionS[otherCall]){
                    WebPhone.error("ConferenceCall, the otherCall is not exist.");
                    return 1;
                }
				WebPhone.SessionS[heldCall]._status = WebPhone.STATUS.STATUS_CONFERENCEING;
				WebPhone.SessionS[heldCall].reinvite({extraHeaders:["P-Conf-MetaData: type=1;join=true"]});
				
				WebPhone.SessionS[otherCall]._status = WebPhone.STATUS.STATUS_CONFERENCEING;
				WebPhone.SessionS[otherCall].reinvite({extraHeaders:["P-Conf-MetaData: type=1;join=false"]});
            },
			
			//单步会议
            SingleStepConference:function (activeCall, destination,userdata){
                WebPhone.debug("SingleStepConference,activeCall:" + activeCall +",destination:" + destination);
                if (!activeCall || !WebPhone.SessionS[activeCall]){
                    WebPhone.error("SingleStepConference, the is not exist.");
                    return 1;
                }
                
				WebPhone.SessionS[activeCall]._status = WebPhone.STATUS.STATUS_SINGLESTEPCONFERENCEING;
				WebPhone.SessionS[activeCall].reinvite({extraHeaders:["P-Conf-MetaData: type=0;user=" + destination + ";join=true",
				"P-User-to-User:" + (userdata ? typeof(userdata) === "string" ? userdata: JSON.stringify(userdata): "")
				]});

            },
            
            // 静音或恢复呼叫
            MuteCall: function () {
                if (WebPhone.ASession) {
                    var i_ret;
                    var bMute = !WebPhone.ASession.bMute;
                    WebPhone.info(bMute ? 'Mute the call...' : 'Unmute the call...');
                    i_ret = WebPhone.ASession.mute('audio'/*could be 'video'*/, bMute);
                    if (i_ret != 0) {
                        WebPhone.error('Mute / Unmute failed');
                        return;
                    }
                    WebPhone.ASession.bMute = bMute;
                }
            },

			setupRemoteMedia:function(session){
				if(!session)
					return;
				
				var audio = session._audio;
				if (!audio){
					audio = document.createElement("audio");
					//audio.setAttribute("id", "audio_remote");
					audio.setAttribute("autoplay", "true");
					document.body.appendChild(audio);
					session._audio = audio;
				}
				
				
				session.sessionDescriptionHandler.on('addTrack', function () {
				  WebPhone.setupRemoteMedia();
				}.bind(session));

				session.sessionDescriptionHandler.on('addStream', function () {
				  WebPhone.setupRemoteMedia();
				}.bind(session));
				
				
				var pc = session.sessionDescriptionHandler.peerConnection;
				var remoteStream;

				if (pc.getReceivers) {
					remoteStream = new window.MediaStream();
					pc.getReceivers().forEach(function (receiver) {
						var track = receiver.track;
						if (track) {
						  remoteStream.addTrack(track);
						}
					});
				} else {
					remoteStream = pc.getRemoteStreams()[0];
				}
					
				if (audio) {
					audio.srcObject = remoteStream;
					/*audio.play().catch(function (e) {
						WebPhone.error('play was rejected:' + e.message);
					}.bind(session));
					*/
				}
					
			},

            /**
             * 返回当前日期+时间
             * @returns {string}
             */
            dateNow: function () {
                var date = new Date();
                var y = date.getFullYear();
                var m = date.getMonth() + 1;
                var d = date.getDate();
                var h = date.getHours();
                var mm = date.getMinutes();
                var s = date.getSeconds();
                var sss = date.getMilliseconds();
                if (m < 10) {
                    m = "0" + m
                }
                if (d < 10) {
                    d = "0" + d
                }
                if (h < 10) {
                    h = "0" + h
                }
                if (mm < 10) {
                    mm = "0" + mm
                }
                if (s < 10) {
                    s = "0" + s
                }
                return y + "-" + m + "-" + d + " " + h + ":" + mm + ":" + s + "." + sss;
            },
            /**
             * 日志
             * @returns {string}
             */
            debug: function (c) {
                if(WebPhone.loglevel == "debug"){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.debug(c);
                }
            },
            
            
            info: function (c) {
                if(WebPhone.loglevel == "debug" || WebPhone.loglevel == "info"){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.info(c);
                }
            },
            
            warn: function (c) {
                if(WebPhone.loglevel == "debug" || WebPhone.loglevel == "info"  || WebPhone.loglevel == "warn"){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.warn(c);
                }
            },
            
            error: function (c) {
                if(WebPhone.loglevel == "debug" || WebPhone.loglevel == "info"  || WebPhone.loglevel == "warn" || WebPhone.loglevel == "error" ){
                    c = "[" + WebPhone.dateNow() + "] " + c;
                    window.console.error(c);
                }
            },
            
            /**
             * 加载后自动调用
             */
            loading: function () {
                WebPhone.getPath();
                WebPhone.createScript(WebPhone._thisPath + "WebPhone-SIP.js");
            },
            /**
             * 获取本文件路径
             * @returns {string}
             */
            getPath: function () {
                if (!WebPhone._thisPath) {
                    var js = document.scripts;
                    for (var i = 0; i < js.length; i++) {
                        var script = js[i];
                        var jsPath = script.src;
                        if (jsPath.indexOf("WebPhone.js") != -1) {
                            WebPhone._thisPath = jsPath.substring(0, jsPath.lastIndexOf("/") + 1);
                        }
                    }
                }
                if (!WebPhone._thisPath) {
                    WebPhone._thisPath = "";
                }
                return WebPhone._thisPath;
            },

            /**
             * 创建script元素
             * @param filePath
             */
            createScript: function (filePath) {
                var tag = document.createElement("script");
                tag.setAttribute('type', 'text/javascript');
                tag.setAttribute('src', filePath);
                var head = document.getElementsByTagName("head");
                head.item(0).appendChild(tag);
            },
            /**
             * 生成uuid
             * @returns {*}
             */
            getUUID: function () {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
        }
    WebPhone.loading();
})();