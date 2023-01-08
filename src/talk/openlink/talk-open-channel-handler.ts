/*
 * Created on Wed Jan 27 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { Long } from 'bson';
import {
  ChatFeed,
  FeedFragment,
  feedFromChat,
  KnownChatType,
  KnownFeedType,
  OpenKickFeed,
  OpenRewriteFeed,
  UpdatableChatListStore,
} from '../../chat';
import { EventContext, TypedEmitter } from '../../event';
import {
  OpenChannel,
  OpenChannelInfo,
  OpenChannelSession,
  OpenChannelUserPerm,
} from '../../openlink';
import { DefaultRes } from '../../request';
import {
  LinkKickedRes,
  SyncEventRes,
  SyncLinkPfRes,
  SyncMemTRes,
} from '../../packet/chat';
import {
  ChannelInfoStruct,
  ChatlogStruct,
  structToChatlog,
  structToOpenLinkChannelUserInfo,
} from '../../packet/struct';
import { ChannelStore, UpdatableChannelDataStore } from '../../channel';
import { OpenChannelEvents, OpenChannelListEvents } from '../event';
import { Managed } from '../managed';
import { ChannelListUpdater } from '../channel/talk-channel-handler';
import { ChannelUser, OpenChannelUserInfo } from '../../user';

type TalkOpenChannelEvents<T> = OpenChannelEvents<T, OpenChannelUserInfo>;

/**
 * Capture and handle pushes coming to open channel
 */
export class TalkOpenChannelHandler<T extends OpenChannel>
  implements Managed<TalkOpenChannelEvents<T>>
{
  constructor(
    private _channel: T,
    private _session: OpenChannelSession,
    private _emitter: TypedEmitter<TalkOpenChannelEvents<T>>,
    private _store: UpdatableChannelDataStore<
      OpenChannelInfo,
      OpenChannelUserInfo
    >,
    private _chatListStore: UpdatableChatListStore,
  ) {}

  private _callEvent<E extends keyof TalkOpenChannelEvents<T>>(
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
    event: E,
    ...args: Parameters<TalkOpenChannelEvents<T>[E]>
  ) {
    this._emitter.emit(event, ...args);
    parentCtx.emit(event, ...args);
  }

  private async _hostHandoverHandler(
    memTData: DefaultRes & SyncMemTRes,
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
  ) {
    if (
      !this._channel.channelId.eq(memTData.c) &&
      !this._channel.linkId.eq(memTData.li)
    )
      return;

    const len = memTData.mids.length;
    for (let i = 0; i < len; i++) {
      const user = { userId: memTData.mids[i] };
      const perm = memTData.mts[i];

      if (!perm) continue;

      const lastInfo = this._store.getUserInfo(user);
      this._store.updateUserInfo(user, { perm });
      const info = this._store.getUserInfo(user);
      if (lastInfo && info) {
        if (perm === OpenChannelUserPerm.OWNER) {
          const lastLink = this._store.info.openLink;
          const res = await this._session.getLatestOpenLink();

          if (res.success) {
            this._store.updateInfo({ openLink: res.result });

            this._callEvent(
              parentCtx,
              'host_handover',
              this._channel,
              lastLink || res.result,
              res.result,
            );
          }
        }

        this._callEvent(
          parentCtx,
          'perm_changed',
          this._channel,
          lastInfo,
          info,
        );
      }
    }
  }

  private _profileChangedHandler(
    pfData: DefaultRes & SyncLinkPfRes,
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
  ) {
    if (
      (pfData.c && !this._channel.channelId.eq(pfData.c)) ||
      (pfData.li && !this._channel.linkId.eq(pfData.li))
    )
      return;

    const last = this._store.getUserInfo(pfData.olu);
    if (!last) return;

    const updated = structToOpenLinkChannelUserInfo(pfData.olu);

    this._store.updateUserInfo(last, updated);

    this._callEvent(parentCtx, 'profile_changed', this._channel, last, updated);
  }

  private _msgHiddenHandler(
    data: DefaultRes,
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
  ) {
    const struct = data['chatLog'] as ChatlogStruct;
    if (!this._channel.channelId.eq(struct.chatId)) return;

    const chatLog = structToChatlog(struct);
    if (chatLog.type !== KnownChatType.FEED) return;
    const feed = feedFromChat(chatLog);
    if (feed.feedType !== KnownFeedType.OPENLINK_REWRITE_FEED) return;

    this._callEvent(
      parentCtx,
      'message_hidden',
      chatLog,
      this._channel,
      feed as OpenRewriteFeed,
    );

    this._chatListStore.addChat(chatLog).then();
  }

  private _chatEventHandler(
    syncEventData: DefaultRes & SyncEventRes,
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
  ) {
    if (
      !this._channel.channelId.eq(syncEventData.c) &&
      !this._channel.linkId.eq(syncEventData.li)
    )
      return;

    const user = this._store.getUserInfo({ userId: syncEventData.authorId });
    if (!user) return;

    this._callEvent(
      parentCtx,
      'chat_event',
      this._channel,
      user,
      syncEventData.et,
      syncEventData.ec,
      { logId: syncEventData.logId, type: syncEventData.t },
    );
  }

  private _channelLinkDeletedHandler(
    data: DefaultRes,
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
  ) {
    if (!this._channel.linkId.eq(data['li'] as Long)) return;
    const struct = data['chatLog'] as ChatlogStruct;

    const chatLog = structToChatlog(struct);
    if (chatLog.type !== KnownChatType.FEED) return;
    const feed = feedFromChat(chatLog);
    if (feed.feedType !== KnownFeedType.OPENLINK_DELETE_LINK) return;

    this._callEvent(
      parentCtx,
      'channel_link_deleted',
      chatLog,
      this._channel,
      feed,
    );

    this._chatListStore.addChat(chatLog).then();
  }

  private async _userJoinHandler(
    data: DefaultRes,
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
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
    parentCtx: EventContext<TalkOpenChannelEvents<T>>,
  ): Promise<void> {
    switch (method) {
      case 'SYNCMEMT':
        await this._hostHandoverHandler(
          data as DefaultRes & SyncMemTRes,
          parentCtx,
        );
        break;
      case 'SYNCLINKPF':
        this._profileChangedHandler(
          data as DefaultRes & SyncLinkPfRes,
          parentCtx,
        );
        break;
      case 'SYNCREWR':
        this._msgHiddenHandler(data, parentCtx);
        break;
      case 'SYNCEVENT':
        this._chatEventHandler(data as DefaultRes & SyncEventRes, parentCtx);
        break;
      case 'NEWMEM':
        await this._userJoinHandler(data, parentCtx);
        break;
      case 'LNKDELETED':
        this._channelLinkDeletedHandler(data, parentCtx);
        break;
    }
  }
}

export class TalkOpenChannelListHandler<T extends OpenChannel, U>
  implements Managed<OpenChannelListEvents<T, U>>
{
  constructor(
    private _list: ChannelStore<T>,
    private _emitter: TypedEmitter<OpenChannelListEvents<T, U>>,
    private _updater: ChannelListUpdater<T>,
  ) {}

  private _callEvent<E extends keyof OpenChannelListEvents<T, U>>(
    parentCtx: EventContext<OpenChannelListEvents<T, U>>,
    event: E,
    ...args: Parameters<OpenChannelListEvents<T, U>[E]>
  ) {
    this._emitter.emit(event, ...args);
    parentCtx.emit(event, ...args);
  }

  async pushReceived(
    method: string,
    data: DefaultRes,
    parentCtx: EventContext<OpenChannelListEvents<T, U>>,
  ): Promise<void> {
    switch (method) {
      case 'SYNCLINKCR': {
        const chatRoom = data['chatRoom'] as ChannelInfoStruct;
        if (!chatRoom) break;

        const channelRes = await this._updater.addChannel({
          channelId: chatRoom.chatId,
        });

        if (channelRes.success) {
          this._callEvent(parentCtx, 'channel_join', channelRes.result as T);
        }

        break;
      }

      case 'LINKKICKED': {
        const kickData = data as DefaultRes & LinkKickedRes;

        const kickedChannel = this._list.get(kickData.c);
        if (!kickedChannel) return;

        const chatLog = structToChatlog(kickData.chatLog);
        if (chatLog.type !== KnownChatType.FEED) return;
        const feed = feedFromChat(chatLog);
        if (feed.feedType !== KnownFeedType.OPENLINK_KICKED) return;

        this._callEvent(
          parentCtx,
          'channel_kicked',
          chatLog,
          kickedChannel,
          feed as OpenKickFeed,
        );

        break;
      }

      case 'SYNCLINKDL': {
        const linkId = data['li'] as Long;

        const channel = (() => {
          for (const channel of this._list.all()) {
            if (channel.linkId.eq(linkId)) return channel;
          }
        })();
        if (!channel) return;

        this._updater.removeChannel(channel);
        this._callEvent(parentCtx, 'channel_left', channel);
      }
    }
  }
}
