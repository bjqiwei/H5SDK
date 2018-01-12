(function () {
    window.WebPhone = window.WebPhone || {
            _version: "2.0.3.22",
            _thisPath: "",

            callid: null,
            audioRemote: null,

            ASession: null,
            oSipSessionTransferCall: null,
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
					if(WebPhone.userAgent.status === SIP.UA.C.STATUS_STARTING){
						WebPhone.error("登录失败:" + JSON.stringify(msg));
						if (typeof(WebPhone.onConnectError) == "function") {
							WebPhone.onConnectError(msg);
						}
					}
					WebPhone.userAgent.stop();
				});
				
				WebPhone.userAgent.on('registered', function(args){
					WebPhone.debug("registered:");
					WebPhone.debug("登录成功");
                    if(typeof(WebPhone.onConnected) == "function"){
                        WebPhone.onConnected();
                    }
				});
				
				WebPhone.userAgent.on('unregistered', function(response,cause){
					var msg = {};
                    msg.reason = response? response.status_code:504;
                    msg.msg = cause;
					WebPhone.debug("unregistered:" + JSON.stringify(msg));
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
					WebPhone.userAgent.stop();
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
                if (WebPhone.userAgent) {
                    // create call session
                    WebPhone.ASession = WebPhone.userAgent.invite(called, {sessionDescriptionHandlerOptions: {
						constraints: {
							audio: true,
							video: false
						}
					}});

					if ( WebPhone.ASession == null) {
						WebPhone.ASession = null;
						WebPhone.error('Failed to make call');
						if (typeof(WebPhone.onMakeCallFailed) == "function") {
							var msg = {};
							msg.reason = err;
							msg.msg="make call failed";
							WebPhone.onMakeCallFailed(msg);
							WebPhone.debug("onMakeCallFailed:" + JSON.stringify(msg));
							return err;
						}
					}
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
                if (WebPhone.ASession) {
                    WebPhone.debug('Terminating the call...');
                    WebPhone.ASession.hangup({events_listener: {events: '*', listener: WebPhone.onSipSessionEvent}});
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
                    case 'terminated'://登出 // 'terminating' | 'terminated'
                    {
                        if (e.session == WebPhone.userAgent) {
                            WebPhone.userAgent = null;
                            if(e.o_event.o_message.line.response.i_status_code != 200)
                            {
                                var msg = {};
                                msg.reason = e.o_event.o_message.line.response.i_status_code;
                                msg.msg = e.description;
                                WebPhone.debug("onConnectError:" + JSON.stringify(msg));
                                WebPhone.error("登录失败:" + e.o_event.o_message.line.response.i_status_code);
                                if (typeof(WebPhone.onConnectError) == "function") {
                                    WebPhone.onConnectError(msg);
                                }
                            }
                            else{
                                WebPhone.debug("onLogout:");
                                WebPhone.info("登出成功");
                                if (typeof(WebPhone.onLogout) == "function") {
                                    WebPhone.onLogout();
                                }
                            }
                            
                        }
                        
                        if (e.session == WebPhone.ASession) {
                            WebPhone.ASession = null;
                            if(typeof(WebPhone.onCallCleared) == "function"){
                                var msg ={};
                                msg.callid=null;
                                msg.msg = e.description;
                                msg.reason = 200;
                                try{
                                    msg.reason = e.o_event.o_message.line.response.i_status_code;
                                }
                                catch (e){
                                }
                                WebPhone.debug("onCallCleared:" + JSON.stringify(msg));
                                WebPhone.info("通话已挂断:" + msg.reason);
                                WebPhone.onCallCleared(msg);
                            }
                        }    
                        break;
                    }
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
                    case 'i_ao_request':
                    {
                        if (e.session == WebPhone.ASession) {
                            var iSipResponseCode = e.getSipResponseCode();
                            if (iSipResponseCode == 100) {
                                var msg = {"callid": null};
                                WebPhone.debug("onOriginated:" + JSON.stringify(msg));
                                WebPhone.info("外呼中...");
                                if (typeof(WebPhone.onOriginated) == "function") {
                                    WebPhone.onOriginated(msg);
                                }
                            }
                            if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                                var msg = {"callid": null};
                                WebPhone.debug("onDelivered:"+JSON.stringify(msg));
                                WebPhone.info('远端振铃...');
                                if (typeof(WebPhone.onDelivered) == "function") {
                                    WebPhone.onDelivered(msg);
                                }
                            }
                            if (iSipResponseCode == 200) {
                                var msg = {"callid": null};
                                WebPhone.debug("onEstablished:" + JSON.stringify(msg));
                                WebPhone.info("通话中");
                                if (typeof(WebPhone.onEstablished) == "function") {
                                    WebPhone.onEstablished(msg);
                                }
                            }
                        }
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
					case "i_info":
					{
						if (e.session == WebPhone.ASession) {
							if(e.getContentType() == "application/dtmf-relay"){
								var dtmf = e.getContentString(); //Signal=9
								dtmf = dtmf.substr(dtmf.indexOf("Signal=")+7,1);
								var msg = {"callid": null,"dtmf":dtmf};
								WebPhone.debug("onDtmfReceived:" + JSON.stringify(msg));
								if (typeof(WebPhone.onDtmfReceived) == "function") {
									WebPhone.onDtmfReceived(msg);
								}
							}
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