/*
 * Created on Sat Jan 23 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import {
  Channel,
  NormalChannelInfo,
  NormalChannelSession,
  UpdatableChannelDataStore,
} from '../../channel';
import {
  ChatFeed,
  FeedFragment,
  feedFromChat,
  KnownChatType,
  UpdatableChatListStore,
} from '../../chat';
import { EventContext, TypedEmitter } from '../../event';
import { ChannelEvents } from '../event';
import { ChatlogStruct, structToChatlog } from '../../packet/struct';
import { DefaultRes } from '../../request';
import { ChannelUser, NormalChannelUserInfo } from '../../user';
import { Managed } from '../managed';

type TalkNormalChannelEvents<T extends Channel> = ChannelEvents<
  T,
  NormalChannelUserInfo
>;

/**
 * Capture and handle pushes coming to channel
 */
export class TalkNormalChannelHandler<T extends Channel>
  implements Managed<TalkNormalChannelEvents<T>>
{
  constructor(
    private _channel: T,
    private _session: NormalChannelSession,
    private _emitter: TypedEmitter<TalkNormalChannelEvents<T>>,
    private _store: UpdatableChannelDataStore<
      NormalChannelInfo,
      NormalChannelUserInfo
    >,
    private _chatListStore: UpdatableChatListStore,
  ) {}

  private _callEvent<E extends keyof TalkNormalChannelEvents<T>>(
    parentCtx: EventContext<TalkNormalChannelEvents<T>>,
    event: E,
    ...args: Parameters<TalkNormalChannelEvents<T>[E]>
  ) {
    this._emitter.emit(event, ...args);
    parentCtx.emit(event, ...args);
  }

  private async _userJoinHandler(
    data: DefaultRes,
    parentCtx: EventContext<TalkNormalChannelEvents<T>>,
  ) {
    const struct = data['chatLog'] as ChatlogStruct;
    if (!this._channel.channelId.eq(struct.chatId)) return;

    const chatLog = structToChatlog(struct);

    // TODO: The event should be called whatever the chat is valid or not.
    if (chatLog.type === KnownChatType.FEED) {
      const feed = feedFromChat(chatLog);

      let userList: ChannelUser[];
      if ('member' in feed) {
        userList = [(feed as ChatFeed & FeedFragment.Member).member];
      } else if ('members' in feed) {
        userList = (feed as ChatFeed & FeedFragment.MemberList).members;
      } else {
        userList = [];
      }

      const usersRes = await this._session.getLatestUserInfo(...userList);

      if (usersRes.success) {
        for (const user of usersRes.result) {
          this._store.updateUserInfo(user, user);

          this._callEvent(
            parentCtx,
            'user_join',
            chatLog,
            this._channel,
            user,
            feed,
          );
        }
      }
    }

    this._chatListStore.addChat(chatLog).then();
  }

  async pushReceived(
    method: string,
    data: DefaultRes,
    parentCtx: EventContext<TalkNormalChannelEvents<T>>,
  ): Promise<void> {
    switch (method) {
      case 'NEWMEM':
        await this._userJoinHandler(data, parentCtx);
        break;
    }
  }
}
