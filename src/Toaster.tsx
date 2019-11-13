import {
  Intent,
  Position,
  Toaster as BlueprintToaster
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

class Toaster {
  static levelIntentMap: any = {
    success: Intent.SUCCESS,
    error: Intent.DANGER
  };
  static levelIconMap: any = {
    success: IconNames.THUMBS_UP,
    error: IconNames.WARNING_SIGN
  };
  static AppToaster = BlueprintToaster.create({
    className: "studio-toaster",
    position: Position.TOP_RIGHT
  });
  static notify(message: any, status?: string, opts?: any) {
    const level = status || "success";
    Toaster.AppToaster.show({
      message,
      intent: Toaster.levelIntentMap[level] || Intent.WARNING,
      icon: Toaster.levelIconMap[level] || IconNames.THUMBS_UP,
      timeout: 5000,
      ...opts
    });
  }
}

export default Toaster;
