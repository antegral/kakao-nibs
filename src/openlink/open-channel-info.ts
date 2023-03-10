/*
 * Created on Mon Jan 25 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { Long } from 'bson';
import { ChannelData, ChannelInfo } from '../channel';
import { OpenChannel } from './open-channel';
import { OpenLink, OpenTokenComponent } from '.';

/**
 * Open channel info
 */
export interface OpenChannelInfo
  extends ChannelInfo,
    OpenChannel,
    OpenTokenComponent {
  /**
   * true if direct channel
   */
  directChannel: boolean;

  openLink?: OpenLink;
}

// eslint-disable-next-line no-redeclare
export namespace OpenChannelInfo {
  export function createPartial(
    info: Partial<OpenChannelInfo>,
  ): OpenChannelInfo {
    return Object.assign(
      {
        ...ChannelInfo.createPartial(info),
        linkId: Long.ZERO,
        openToken: 0,

        directChannel: false,

        openLink: null,
      },
      info,
    );
  }
}

export interface OpenChannelData
  extends OpenChannel,
    ChannelData<OpenChannelInfo> {}
