import { Injectable } from '@nestjs/common';

export type Collection = 'users' | 'wallets'

@Injectable()
export class DB {
  private readonly collections = new Map<Collection, Map<string, any>>()

  private collection (name: Collection) {
    let collection = this.collections.get(name)

    if (!collection) {
      collection = new Map()
      this.collections.set(name, collection)
    }

    return collection
  }

  save (collection: Collection, key: string, value: any) {
    this.collection(collection).set(key, value)
    return value
  }

  getItem (collection: Collection, key: string) {
    return this.collection(collection).get(key)
  }

  getAll (collection: Collection) {
    return Array.from(this.collection(collection).values())
  }
}
