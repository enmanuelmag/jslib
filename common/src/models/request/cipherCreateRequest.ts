import { CipherRequest } from "./cipherRequest";

import { Cipher } from "../domain/cipher";

export class CipherCreateRequest {
  cipher: CipherRequest;
  collectionIds: string[];

  constructor(cipher: Cipher) {
    this.cipher = new CipherRequest(cipher);
    this.collectionIds = cipher.collectionIds;
  }
}
