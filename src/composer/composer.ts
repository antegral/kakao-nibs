import { ClientEvents } from '@src/talk/event';
import { TalkChannel, ChannelUserInfo } from '..';
import { TalkCallBack } from './callback';
import { TalkComponent } from './component';

export class TalkComposer extends TalkComponent {
  protected children: TalkComponent[] = [];

  public add(component: TalkComponent): void {
    this.children.push(component);
    component.setParent(this);
  }

  public remove(component: TalkComponent): void {
    const componentIndex = this.children.indexOf(component);
    this.children.splice(componentIndex, 1);

    component.setParent(null);
  }

  public isComposite(): boolean {
    return true;
  }

  public init(): this {
    for (const child of this.children) {
      child.init();
    }

    return this;
  }

  use<T extends keyof ClientEvents<TalkChannel, ChannelUserInfo>>(
    event: T,
    callback: ClientEvents<TalkChannel, ChannelUserInfo>[T],
  ) {
    for (const child of this.children) {
      child.use(event, callback);
    }
    return this;
  }
}
