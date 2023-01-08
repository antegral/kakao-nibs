import { ClientEvents } from '@src/talk/event';
import { TalkComponent } from '.';
import { ChannelUserInfo, TalkChannel } from '..';
import { TalkCallBack } from './callback';
import { ComposedClient } from './client';

export class TalkLeaf extends TalkComponent {
  public talkCallbacks: TalkCallBack[] = [];

  constructor(public client: ComposedClient) {
    super();
    this.client.on('chat', (data, channel) => {
      this.talkCallbacks
        .filter((v) => v.event == 'chat')
        .forEach((v) => v.callback(data, channel));
    });
    this.client.on('user_join', (data, channel) => {
      this.talkCallbacks
        .filter((v) => v.event == 'user_join')
        .forEach((v) => v.callback(data, channel));
    });
    this.client.on('user_left', (data, channel) => {
      this.talkCallbacks
        .filter((v) => v.event == 'user_join')
        .forEach((v) => v.callback(data, channel));
    });
  }

  public init(promise?: Promise<string>): this {
    this.client.init(promise);
    return this;
  }

  static create(email: string, password: string, name: string, uuid: string) {
    return new TalkLeaf(new ComposedClient(email, password, name, uuid));
  }

  use<T extends keyof ClientEvents<TalkChannel, ChannelUserInfo>>(
    event: T,
    callback: ClientEvents<TalkChannel, ChannelUserInfo>[T],
  ) {
    this.talkCallbacks.push(new TalkCallBack<T>(event, callback));
    return this;
  }
}
