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

  public onMessage(): this {
    return this;
  }
}
