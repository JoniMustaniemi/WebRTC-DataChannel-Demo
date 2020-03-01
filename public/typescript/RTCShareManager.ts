class ConnectionManager {
  private options: any;

  public liveModeStatus_client_1: boolean;
  public RTCPeerConnection_client_1: any;
  public RTCPeerConnectionObject_client_1: RTCPeerConnection;
  private offer_client_1: RTCSessionDescriptionInit;
  public liveModeStatus_client_2: boolean;
  public RTCPeerConnection_client_2: any;
  public RTCPeerConnectionObject_client_2: RTCPeerConnection;
  private answer_client_2: RTCSessionDescriptionInit;
  public datachannel_client_1: RTCDataChannel;
  public datachannel_client_2: RTCDataChannel;
  public stopLiveMode: Function;

  //creates reference for UI element handling
  constructor(options: any) {
    this.options = options;
  }

  //initializes RTCPeerConnection objects and sets appropriate eveten handlers for each client
  public startConnection(liveModeStatus: boolean, client: string) {
    if (client == "1") {
      this.liveModeStatus_client_1 = liveModeStatus;
      if (!this.RTCPeerConnection_client_1) {
        this.RTCPeerConnection_client_1 = new Connection("1", this.options);
        this.RTCPeerConnectionObject_client_1 = this.RTCPeerConnection_client_1.client.object;
        this.datachannel_client_1 = this.RTCPeerConnectionObject_client_1.createDataChannel("channel1");
        this.setEventHandlers("1");
      }
    } else if (client == "2") {
      this.liveModeStatus_client_2 = liveModeStatus;
      if (!this.RTCPeerConnection_client_2) {
        this.RTCPeerConnection_client_2 = new Connection("2", this.options);
        this.RTCPeerConnectionObject_client_2 = this.RTCPeerConnection_client_2.client.object;
        this.setEventHandlers("2");
      }
    }
    return;
  }

  private setEventHandlers(client) {
    if (client == "1") {
      this.RTCPeerConnectionObject_client_1.onicecandidate = (event) => {
        if (event.candidate) {
          try {
            this.RTCPeerConnectionObject_client_2.addIceCandidate(event.candidate);
          } catch (error) {
            console.log(error);
            return;
          }
        } else {
          console.log("all candidates sent by client 1");
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "new" && this.RTCPeerConnectionObject_client_2.iceConnectionState === "new") {
            this.stopLiveMode({
              restart: true
            });
          }
        }
      };

      //when negotiation is needed starts connection handshake procedure
      this.RTCPeerConnectionObject_client_1.onnegotiationneeded = () => {
        if (this.liveModeStatus_client_1 && this.liveModeStatus_client_2) {
          this.createOffer(this.RTCPeerConnectionObject_client_1, "1");
        }
      }

       //listens RTCPeerConnection objects for connection state changes and makes appropriate actions
      this.RTCPeerConnectionObject_client_1.addEventListener("iceconnectionstatechange", ev => {
        if (this.RTCPeerConnectionObject_client_1) {
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "disconnected") {
            this.RTCPeerConnectionObject_client_1.close();
            this.RTCPeerConnectionObject_client_1 = null;
          }
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "connected") {
            console.log("client 1 connected")
          }
          if (this.RTCPeerConnectionObject_client_1.iceConnectionState === "closed") {
            return;
          }
        }
      }, false);

       //listens datachannel for various events and takes appropriate action
      this.datachannel_client_1.onopen = (event) => {

        this.handleDataChannelOpen(event, "1");
      }
      this.datachannel_client_1.onmessage = (event) => {
        this.handleDataChannelMessageReceived(event, "1");
      }
      this.datachannel_client_1.onerror = this.handleDataChannelError;

      this.datachannel_client_1.onclose = (event) => {
        this.handleDataChannelClose("1");

      }
    } else if (client == "2") {
      this.RTCPeerConnectionObject_client_2.addEventListener("iceconnectionstatechange", ev => {
        if (this.RTCPeerConnectionObject_client_2) {
          if (this.RTCPeerConnectionObject_client_2.iceConnectionState === "disconnected" || this.RTCPeerConnectionObject_client_2.iceConnectionState === "closed") {
            this.RTCPeerConnectionObject_client_2.close();
          }
          if (this.RTCPeerConnectionObject_client_2.iceConnectionState === "connected") {
            console.log("client 2 connected");
          }
        }
      }, false);

      //When IceCandidate is found adds it to the other client
      this.RTCPeerConnectionObject_client_2.onicecandidate = (event) => {
        if (event.candidate) {
          try {
            this.RTCPeerConnectionObject_client_1.addIceCandidate(event.candidate);
          } catch (error) {
            console.log(error);
          }
        } else {
          console.log("all candidates sent by client 2");
        }
        this.RTCPeerConnectionObject_client_2.ondatachannel = (event) => {
          this.datachannel_client_2 = event.channel;
          this.datachannel_client_2.onopen = (event) => {
            this.handleDataChannelOpen(event, "2");
          }
          this.datachannel_client_2.onmessage = (event) => {
            this.handleDataChannelMessageReceived(event, "2");
          }
          this.datachannel_client_2.onerror = this.handleDataChannelError;
          this.datachannel_client_2.onclose = (event) => {
            this.handleDataChannelClose("2");
          }
        }
      };
    }
  }

  private handleDataChannelOpen(event, client) {
    if (client == "1") {
      console.log("Datachannel is open");
      this.datachannel_client_1 = event.target;
    } else {
      this.datachannel_client_2 = event.target;
    }
    if (this.datachannel_client_2 && this.datachannel_client_1) {
      if (this.datachannel_client_1.readyState == "open" && this.datachannel_client_2.readyState == "open") {
        if (typeof this.options.event_handlers.on_established_connection === 'function') {
          this.options.event_handlers.on_established_connection({});
        }
      }
    } else {
      return;
    }
  }

//when message is received parses message and updates UI elements
  private handleDataChannelMessageReceived(event, client) {
    let message = JSON.parse(event.data);
    if (client == "2") {
      if (typeof this.options.event_handlers.on_datachannel_close === 'function') {
        this.options.event_handlers.on_message({
          clientId: "2",
          message: event.data
        });
      }
    } else if (client == "1") {
      if (typeof this.options.event_handlers.on_message === 'function') {
        this.options.event_handlers.on_message({
          clientId: "1",
          message: event.data
        });
      }
    }
  }

  private handleDataChannelError(error) {
    console.log(error);
  }

  private handleDataChannelClose(client) {
    console.log("datachannel closed by client " + client);
    if (typeof this.options.event_handlers.on_datachannel_close === 'function') {
      this.options.event_handlers.on_datachannel_close({});
    }
  }

  public closeConnection(client: string) {
    if (client == "1") {
      this.RTCPeerConnectionObject_client_1.close();
      this.RTCPeerConnection_client_1 = null;
    } else if (client == "2") {

      this.RTCPeerConnectionObject_client_2.close();
      this.RTCPeerConnection_client_2 = null;
    }
    this.checkLivemodeStatuses(this.liveModeStatus_client_1, this.liveModeStatus_client_2);
  }

  // handles updating UI elements when neither client is in livemode because connection objects were terminated
  private checkLivemodeStatuses(status_client_1, status_client_2) {
    if (status_client_1 == false || status_client_2 == false) {
      if (typeof this.options.event_handlers.no_live_mode === 'function') {
        this.options.event_handlers.no_live_mode({});
      }
    }
  }

  //creates SDP offer for the purpose of starting a new WebRTC connection with another client
  private async createOffer(RTC_object: RTCPeerConnection, client: string) {
    try {
      if (client == "1") {
        this.offer_client_1 = await RTC_object.createOffer();
        var debugOffer = this.offer_client_1;
        await RTC_object.setLocalDescription(this.offer_client_1);
        if (RTC_object.signalingState == "have-local-offer") {
          this.setRemote(this.offer_client_1, "offer", this.RTCPeerConnectionObject_client_2);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  private async setRemote(sessionDesc: RTCSessionDescriptionInit, type: string, RTC_object: RTCPeerConnection) {
    if (type == "offer") {
      try {
        await RTC_object.setRemoteDescription(sessionDesc);
        //creates an SDP answer to an offer received from another client
        this.answer_client_2 = await RTC_object.createAnswer();
        await RTC_object.setLocalDescription(this.answer_client_2);
        //todo: move remote and local handling to connection class
        if (RTC_object.signalingState == "stable") {
          this.setRemote(this.answer_client_2, "answer", this.RTCPeerConnectionObject_client_1);
        }
      } catch (error) {
        console.log(error);
      }
    } else if (type == "answer") {
      try {
        await RTC_object.setRemoteDescription(sessionDesc);
      } catch (error) {
        console.log(error);
      }
    }
  }
}

interface IClient {
  id: string;
  object: RTCPeerConnection;
}

class Connection {
  public client: IClient;

  constructor(client: string, options: any) {
    this.client = {
      id: client,
      object: new RTCPeerConnection()
    };
  }
}

class RTCShareManager {
  private liveModeStatus_client_1: boolean = false;
  private liveModeStatus_client_2: boolean = false;
  private conMan: ConnectionManager;
  private options: any;

  constructor(options: any) {
    this.options = options;
    this.conMan = new ConnectionManager(
      options
    );

    //if WebRTC connection fails, initializes restart functionality
    this.conMan.stopLiveMode = (args: any) => {
      this.stopLiveMode(args.restart);
    }
  }

  //handles livemode functionality. initializes connection sequences and is responsible for ending connection if livemode is turned off 
  public liveMode() {
    if (typeof this.options.event_handlers.on_live_mode === 'function') {
      this.options.event_handlers.on_live_mode({
        isLive: !this.liveModeStatus_client_1,
      });
    }

    if (!this.liveModeStatus_client_1) {
      this.liveModeStatus_client_1 = true;
      this.liveModeStatus_client_2 = true;
      this.conMan.startConnection(this.liveModeStatus_client_1, "1");
      this.conMan.startConnection(this.liveModeStatus_client_2, "2");
    } else {
      this.stopLiveMode("1");
      this.stopLiveMode("2");
    }
  }

  private stopLiveMode(client ? : string, restart ? : boolean) {
    if (client == "1") {
      this.liveModeStatus_client_1 = false;
      this.conMan.liveModeStatus_client_1 = false;
      if (this.conMan.RTCPeerConnection_client_1) {
        this.conMan.closeConnection("1");
        this.conMan.RTCPeerConnection_client_1 = undefined;
        this.conMan.datachannel_client_1 = null;
      }
    } else if (client == "2") {
      //this.aShare.close("2");
      this.liveModeStatus_client_2 = false;
      this.conMan.liveModeStatus_client_2 = false;
      if (this.conMan.RTCPeerConnection_client_2) {
        this.conMan.closeConnection("2");
        this.conMan.RTCPeerConnection_client_2 = undefined;
        this.conMan.datachannel_client_2 = null;
      }
    } else if (restart !== undefined) {
      console.log("trying again..")
      this.liveModeStatus_client_1 = false;
      this.liveModeStatus_client_2 = false;
      this.conMan.RTCPeerConnection_client_1 = null;
      this.conMan.RTCPeerConnection_client_2 = null;
      this.conMan.RTCPeerConnectionObject_client_1 = null;
      this.conMan.RTCPeerConnectionObject_client_2 = null;
      this.conMan.datachannel_client_1 = null;
      this.conMan.datachannel_client_2 = null;

      this.liveModeStatus_client_1 = true;
      this.liveModeStatus_client_2 = true;
      this.conMan.startConnection(this.liveModeStatus_client_1, "1");
      this.conMan.startConnection(this.liveModeStatus_client_2, "2");
    }
  }
   //validates received message, stringifies it and sends it through datachannel to another client. updated UI elements to display 'my message' on chat window
  private checkMessage(chatInputValue, client) {
    if (!chatInputValue.length || !chatInputValue.replace(/\s/g, '').length) {
      return;
    } else {
      let trimmedValue = chatInputValue.trim();
      chatInputValue = JSON.stringify(trimmedValue);
      this.createMyMessage(chatInputValue, client);
      this.sendMessage(chatInputValue, client);
    }
  }

  private sendMessage(chatInputValue, client) {
    if (client == "1") {
      if (this.conMan.datachannel_client_1) {
        this.conMan.datachannel_client_1.send(chatInputValue);
      }

    } else if (client == "2") {
      if (this.conMan.datachannel_client_2) {
        this.conMan.datachannel_client_2.send(chatInputValue);
      }
    }
  }
  //checks pressed key and if it is 'Enter' key, starts  message validating
  public checkKey(key, client, element) {
    if (key == "13" && client == "1") {
      let message = element.value;
      this.checkMessage(message, "1");
      element.value = "";
    } else if (key == "13" && client == "2") {
      let message = element.value;
      this.checkMessage(message, "2");
      element.value = "";
    }
  }

  private createMyMessage(message, client) {
    if (typeof this.options.event_handlers.on_send_message === 'function') {
      this.options.event_handlers.on_send_message({
        clientId: client,
        message: message
      });
    }
  }
}
