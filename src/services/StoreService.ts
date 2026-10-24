// 결제 인터페이스. 시제품은 Noop. 모바일(광고 제거·꾸미기)과 Steam(유료 완전판)은 구현체를 따로 둔다.

export type ProductId = 'remove_ads' | 'skin_pack_1';

export interface StoreService {
  readonly available: boolean;
  purchase(product: ProductId): Promise<boolean>;
  owns(product: ProductId): boolean;
}

export class NoopStoreService implements StoreService {
  readonly available = false;
  async purchase(): Promise<boolean> {
    return false;
  }
  owns(): boolean {
    return false;
  }
}
