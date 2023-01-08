import { ClientEvents } from '@src/talk/event';
import { TalkChannel, ChannelUserInfo } from '..';

export abstract class TalkComponent {
  protected parent!: TalkComponent | null;

  public setParent(parent: TalkComponent | null) {
    this.parent = parent;
  }

  public getParent(): TalkComponent | null {
    return this.parent;
  }

  public add(component: TalkComponent): void {}

  public remove(component: TalkComponent): void {}

  public isComposite(): boolean {
    return false;
  }

  public abstract use<
    T extends keyof ClientEvents<TalkChannel, ChannelUserInfo>,
  >(event: T, callback: ClientEvents<TalkChannel, ChannelUserInfo>[T]): this;

  public abstract init(): this;
}
