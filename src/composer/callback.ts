import { ClientEvents } from '@src/talk/event';
import { TalkChannel, ChannelUserInfo } from '..';

export class TalkCallBack<
  T extends keyof ClientEvents<TalkChannel, ChannelUserInfo> = any,
> {
  callback: ClientEvents<TalkChannel, ChannelUserInfo>[T] = () => {};

  constructor(
    public event: T,
    callback: ClientEvents<TalkChannel, ChannelUserInfo>[T],
  ) {
    this.callback = callback;
  }
}
