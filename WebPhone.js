(function () {
    window.WebPhone = window.WebPhone || {
            _version: "2.0.3.22",
            _thisPath: "",

            callid: null,
            audioRemote: null,

            SessionS: {},
            userAgent: null,
            loglevel:"debug",
            
            
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
                var audio = document.createElement("audio");
                //audio.setAttribute("id", "audio_remote");
                audio.setAttribute("autoplay", "true");
                document.body.appendChild(audio);
                WebPhone.audioRemote = audio;
                
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
				  traceSip: true,
				  //register: true,
				  autostart: false,
				  allowLegacyNotifications: true,
				  //hackIpInContact: true,
				  //hackViaTcp: true,
				  registerExpires: 300,
				  wsServerMaxReconnection: 1,
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
                    msg.reason = args.code?args.code:1006;
                    msg.msg = args.response ? args.response:"WebSocket connection error";
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
                    msg.reason = response? response.status_code:504;
                    msg.msg = response?response.reason_phrase:cause;
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
                    msg.reason = response.status_code? response.status_code:200;
                    msg.msg = cause;
					WebPhone.debug("registrationFailed:" + JSON.stringify(msg));
                    WebPhone.error("登录失败:" + JSON.stringify(msg));
                    if (typeof(WebPhone.onConnectError) == "function") {
                        WebPhone.onConnectError(msg);
                    }
				});
				
				WebPhone.userAgent.on('invite', function (session) {
					WebPhone.debug('invite:' + session.call_id);
					WebPhone.SessionS[session.call_id] = session; 

					var sRemoteNumber = (WebPhone.oSipSessionCall.getRemoteFriendlyName() || 'unknown');
                    var msg = {"callid": null, "caller": sRemoteNumber};
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
            //呼叫
            MakeCall: function (called) {
                WebPhone.debug("MakeCall:" + called);
				var session = null;
                if (WebPhone.userAgent) {
                    // create call session
                    session = WebPhone.userAgent.invite(called, {sessionDescriptionHandlerOptions: {
						constraints: {
							audio: true,
							video: false
						}
					}});
					
					if (session == null) {
						
						WebPhone.error('Failed to make call');
						if (typeof(WebPhone.onMakeCallFailed) == "function") {
							var msg = {};
							msg.reason = 1;
							msg.msg="make call failed";
							WebPhone.onMakeCallFailed(msg);
							WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
			 				return err;
						}
					}
					
					var call_id = session.id.substr(0,session.id.indexOf(session.from_tag));
					WebPhone.debug("MakeCall:" + call_id);
					session.on('progress', function (response) {
						//debugger;
						WebPhone.debug('progress');
                        var msg = {"callid": response.call_id};
						if(response.status_code == 100){
							WebPhone.debug("onOriginated:" + JSON.stringify(msg));
							WebPhone.info("外呼中...");
							if (typeof(WebPhone.onOriginated) == "function") {
								WebPhone.onOriginated(msg);
							}
						}
						else if(response.status_code == 180 || response.status_code == 183){
							WebPhone.debug('远端振铃...');
                            var msg = {"callid": response.call_id};
                            WebPhone.debug("onDelivered:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onDelivered) == "function") {
                                WebPhone.onDelivered(msg);
                            }
						}
                        
					});
					
					session.on('accepted', function (data) {
						WebPhone.debug('accepted');;
                        var msg = {"callid": data.call_id,"msg":data.reason_phrase};
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
						//debugger;
						if(message === null || cause === null){
							return;
						}
						
						WebPhone.debug('terminated:' + cause);
						var msg = {"callid":message.call_id,"reason":message.status_code ? message.status_code:200,"msg":cause?cause:"OK"};
						WebPhone.debug("onCallCleared:" + JSON.stringify(msg));
                        WebPhone.info("通话已挂断:" + msg.reason);
                        WebPhone.onCallCleared(msg);
						delete WebPhone.SessionS[message.call_id];
					});
					
					session.on('cancel', function() {
						WebPhone.debug('cancel');
					});
					
					session.on('reinvite', function(session) {
						WebPhone.debug('reinvite');
					});
					
					session.on('replaced', function (newSession) {
						WebPhone.debug('replaced');
					});
					
					session.on('dtmf', function(request, dtmf) {
						WebPhone.debug('dtmf');
						var msg = {"callid": request.call_id,"dtmf":dtmf};
						WebPhone.debug("onDtmfReceived:" + JSON.stringify(msg));
						if (typeof(WebPhone.onDtmfReceived) == "function") {
							WebPhone.onDtmfReceived(msg);
						}
					});
					
					session.on('bye', function(request) {
						//debugger;
						WebPhone.debug('bye:' + request.call_id);
						var msg = {"callid":request.call_id,"reason":200,"msg":request.method};
						WebPhone.debug("onCallCleared:" + JSON.stringify(msg));
                        WebPhone.info("通话已挂断:" + msg.reason);
                        WebPhone.onCallCleared(msg);
						delete WebPhone.SessionS[request.call_id];
					});
					
					WebPhone.SessionS[call_id] = session;
                }
                else if (typeof(WebPhone.onMakeCallFailed) == "function") {
                    var msg = {};
                    msg.reason = 1;
                    msg.msg="未注册";
                    WebPhone.onMakeCallFailed(msg);
                    WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
                    return 1;
                }
                return 0;
            },
            //摘机
            AnswerCall: function (callid) {
                WebPhone.debug("AnswerCall:" + callid);
                if (WebPhone.ASession) {
                    WebPhone.debug('Connecting...');
                    WebPhone.ASession.accept(WebPhone.oConfigCall);
                }
            },
            // 挂断 (SIP BYE or CANCEL)
            ClearCall: function (callid, reason) {
                WebPhone.debug("ClearCall, callid:" + callid + ",reason:" + reason);
                if (callid) {
                    WebPhone.debug('Terminating the call...'+callid);
					
                    WebPhone.SessionS[callid].terminate({status_code:reason});
                }
				else{
					WebPhone.debug('Terminating all call...');
					var call_id;
					for(call_id in WebPhone.SessionS){
						 WebPhone.debug('Terminating the call...'+call_id);
						 WebPhone.SessionS[call_id].terminate({status_code:reason});
					}
					
				}
                return 0;
            },
            //发送DTMF
            SendDTMF: function (callid, c) {
                var err = 1;
                if (WebPhone.ASession && c) {
				    err = WebPhone.ASession.dtmf(c);
                }
				WebPhone.debug("SendDTMF,callid:" + callid + ",c:" + c + ",result:" + err);
            },
            // 呼转
            TransferCall: function (callid, s_destination) {
                WebPhone.debug("TransferCall,callid:" + callid+ ",destination:" + s_destination);
                if (WebPhone.ASession) {
                    
                    var err = WebPhone.ASession.transfer(s_destination)
                    if(err != 0){ 
                        WebPhone.error('Call transfer failed:'+err);
                    }
                    else {
                        WebPhone.debug('Transfering the call...');
                    }
                    return err;
    
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
                if (WebPhone.ASession) {
                    var err = WebPhone.ASession.hold(WebPhone.oConfigCall);
                    WebPhone.debug('Holding the call...'+err);
                    return err;
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
                if (WebPhone.ASession) {
                    var err = WebPhone.ASession.resume(WebPhone.oConfigCall);
                    WebPhone.debug('Retrieve the call...' + err);
                    return err;
                  
                } else {
                    WebPhone.error("RetrieveCall, the call is not exist.");
                    return 2;
                }
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

            /**
             * SIP请求回调函数 (INVITE, REGISTER, MESSAGE...)
             * @param e SIP.Session.Event
             */
            onSipSessionEvent: function (e) {
                WebPhone.debug("收到Session事件：" + e.type);
                switch (e.type) {
                    
                    case 'm_stream_audio_local_added':
                    case 'm_stream_audio_local_removed':
                    case 'm_stream_audio_remote_added':
                    case 'm_stream_audio_remote_removed':
                    {
                        break;
                    }
                    case 'i_ect_new_call':
                    {
                        WebPhone.oSipSessionTransferCall = e.session;
                        break;
                    }

                    case 'm_early_media':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.debug('远端振铃...');
                            var msg = {"callid": null};
                            WebPhone.debug("onDelivered:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onDelivered) == "function") {
                                WebPhone.onDelivered(msg);
                            }
                        }
                        break;
                    }
                    case 'm_local_hold_ok':
                    {
                        if (e.session == WebPhone.ASession) {
                            var msg = {"callid": null};
                            WebPhone.debug("onHeld:"+JSON.stringify(msg));
                            if (typeof(WebPhone.onHeld) == "function") {
                                    WebPhone.onHeld(msg);
                            }
                            WebPhone.debug('通话保持');
                        }
                        break;
                    }
                    case 'm_local_hold_nok':
                    {
                        if (e.session == WebPhone.ASession) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"通话保持失败"};
                            WebPhone.debug("onHeldFailed:"+JSON.stringify(msg));
                            if (typeof(WebPhone.onHeldFailed) == "function") {
                                WebPhone.onHeldFailed(msg);
                            }
                            WebPhone.error('通话保持失败');
                        }
                        break;
                    }
                    case 'm_local_resume_ok':
                    {
                        if (e.session == WebPhone.ASession) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"通话恢复"};
                            WebPhone.debug("onRetrieved:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onRetrieved) == "function") {
                                    WebPhone.onRetrieved(msg);
                             }
                            WebPhone.debug('通话恢复');
                        }
                        break;
                    }
                    case 'm_local_resume_nok':
                    {
                        if (e.session == WebPhone.ASession) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"通话恢复失败"};
                            WebPhone.debug("onRetrieveFailed:"+msg);
                            if (typeof(WebPhone.onRetrieveFailed) == "function") {
                                    WebPhone.onRetrieveFailed(msg);
                            }
                            WebPhone.error('恢复通话失败');
                        }
                        break;
                    }
                    case 'm_remote_hold':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.info('远端通话保持');
                        }
                        break;
                    }
                    case 'm_remote_resume':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.info('远端恢复通话');
                        }
                        break;
                    }
                    case 'o_ect_trying':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.debug('呼叫转接中...');
                        }
                        break;
                    }
                    case 'o_ect_accepted':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.debug('呼叫转接接听');
                        }
                        break;
                    }
                    case 'o_ect_completed':
                    case 'i_ect_completed':
                    {
                        if (e.session == WebPhone.ASession) {
                            var msg = {"callid": null};
                            WebPhone.debug("onTransferred:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onTransferred) == "function") {
                                WebPhone.onTransferred(msg);
                            }
                            WebPhone.info('呼叫转接结束');
                        }
                        break;
                    }
                    case 'o_ect_failed':
                    case 'i_ect_failed'://转接失败
                    {
                        if (e.session == WebPhone.ASession) {
                            var msg = {"callid": null,reason:e.getSipResponseCode(),"msg":"呼叫转接失败"};
                            WebPhone.debug("onTransferFailed:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onTransferFailed) == "function") {
                                WebPhone.onTransferFailed(msg);
                            }
                            WebPhone.error('呼叫转接失败');
                        }
                        break;
                    }
                    case 'o_ect_notify':
                    case 'i_ect_notify':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.debug("转接:" + e.getSipResponseCode() + " " + e.description);
                            var msg = {"callid": null};
                            WebPhone.debug("onTransferred:" + JSON.stringify(msg));
                            if (typeof(WebPhone.onTransferred) == "function") {
                                WebPhone.onTransferred(msg);
                            }
                        }
                        break;
                    }
                    case 'i_ect_requested':
                    {
                        if (e.session == WebPhone.ASession) {
                            WebPhone.debug("转接请求...");
                            var s_message = "是否转接到 [" + e.getTransferDestinationFriendlyName() + "]?";
                            //WebPhone.ASession.acceptTransfer();
                            //WebPhone.ASession.rejectTransfer();
                        }
                        break;
                    }
					
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