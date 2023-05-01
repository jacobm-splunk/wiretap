import {RanchUtils} from "./utils";
import {Client, StompConfig} from "@stomp/stompjs";


export type BusCallback = (message: Message) => void

export interface Subscription {
    unsubscribe(): void
}

export interface Subscriber {
    name: string
    callback: BusCallback
}

export interface Message {
    id?: string
    command?: string
    payload?: any
}

export interface Channel {
    name: string
    subscribe(callback: BusCallback): Subscription
    publish(message: Message): void
}

export interface Bus {
    channels: Channel[]
    createChannel(channelName: string): Channel
    connectToBroker(config: StompConfig)
    mapChannelToBrokerDestination(destination: string, channel: string): void
}

export function CreateBus(): Bus {
    return new bus();
}

export class bus implements Bus {
    private _channels: Channel[] = []
    private _stompClient: Client
    private _preMappedChannels: Map<string, string>
    constructor() {
        this._preMappedChannels = new Map<string, string>()
    }

    get channels(): Channel[] {
        return this._channels
    }
    createChannel(channelName: string): Channel {
        const chan = new channel(channelName)
        this._channels.push(chan)
        return chan
    }
    connectToBroker(config: StompConfig) {
        this._stompClient = new Client(config)
        this._stompClient.activate()
        this._stompClient.onConnect = (frame) => {
            this._preMappedChannels.forEach((channel: string, destination: string) => {
                this._mapDestination(destination, channel)
            });
        }
    }

    private _mapDestination(destination: string, channel: string) {
        this._stompClient.subscribe(destination, message => {
            const chan = this._channels.find(c => c.name === channel)
            if (chan) {
                chan.publish({payload: JSON.parse(message.body)})
            }
        });
    }
    mapChannelToBrokerDestination(destination: string, channel: string) {
        if (!this._stompClient || !this._stompClient.connected) {
            this._preMappedChannels.set(destination, channel)
        } else {
            this._mapDestination(destination, channel)
        }
    }
}

class channel implements Channel {
    private subscribers: Subscriber[] = []
    private readonly _name: string
    constructor(channelName: string) {
        this._name = channelName
    }
    get name(): string {
        return this._name
    }
    subscribe(callback: BusCallback): Subscription {
        const subscriber: Subscriber = {
            name: RanchUtils.genUUID(),
            callback: callback
        }
        this.subscribers.push(subscriber)
        return {
            unsubscribe: () => {
                this.subscribers =
                    this.subscribers.filter((s: Subscriber) => s.name !== subscriber.name)
            }
        }
    }
    publish(message: any): void {
        this.subscribers.forEach((s: Subscriber) => s.callback(message))
    }
}


