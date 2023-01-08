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

  public abstract init(): this;
}
