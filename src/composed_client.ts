import { createInterface } from 'readline';
import { AuthApiClient, KnownAuthStatusCode } from './api';
import { TalkChannel, TalkChatData, TalkClient } from './talk';

abstract class TalkComponent {
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

export class ComposedClient extends TalkClient {
  _auth: AuthApiClient | undefined;

  get auth() {
    if (this._auth) {
      return this._auth;
    }
    throw new Error('auth is not created!');
  }

  set auth(auth: AuthApiClient) {
    this._auth = auth;
  }

  constructor(
    public email: string,
    public password: string,
    public name: string,
    public uuid: string,
    public logger: { log: (str: string) => void } = console,
  ) {
    super();
  }
  private async _init() {
    if (!this._auth) {
      this.auth = await AuthApiClient.create(this.name, this.uuid);
    }
  }

  async init(promise?: Promise<string>) {
    await this._init();
    const loginForm = {
      email: this.email,
      password: this.password,
    };
    const res = await this.auth.login(loginForm);
    if (res.success) {
      const resp = await this.login(res.result);
      this.logger.log(
        resp.success
          ? 'loco login success'
          : 'loco login Failed.. status : ' + resp.status,
      );
    } else {
      if (res.status == KnownAuthStatusCode.DEVICE_NOT_REGISTERED) {
        await this.auth.requestPasscode(loginForm);

        if (promise) {
          const passcode = await promise;
          await this.auth.registerDevice(loginForm, passcode);
          await this.init(promise);
        } else {
          const input = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const passcode = await new Promise<string>((res) =>
            input.question('PASSCODE : ', res),
          );
          await this.auth.registerDevice(loginForm, passcode);
          await this.init(promise);
        }
      } else {
        throw new Error(`check your credential!! status : ${res.status}`);
      }
    }
  }
}

export class TalkLeaf extends TalkComponent {
  constructor(public client: ComposedClient) {
    super();
  }

  public init(promise?: Promise<string>): this {
    this.client.init(promise);
    return this;
  }

  static create(email: string, password: string, name: string, uuid: string) {
    return new TalkLeaf(new ComposedClient(email, password, name, uuid));
  }
}

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
}
