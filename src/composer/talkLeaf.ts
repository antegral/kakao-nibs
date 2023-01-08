import { TalkComponent } from '.';
import { ComposedClient } from './client';

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
