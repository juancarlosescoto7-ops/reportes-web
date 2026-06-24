declare module "jscanify/client" {
  export default class Jscanify {
    extractPaper(
      image: HTMLCanvasElement,
      resultWidth: number,
      resultHeight: number
    ): HTMLCanvasElement | null;
  }
}
