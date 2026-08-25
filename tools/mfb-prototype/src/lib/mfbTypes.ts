/**
 * Apple Messages for Business–shaped interactive payloads (simplified for local prototyping).
 * Field names track Apple's interactiveData dictionaries so an MSP swap is mostly transport.
 * @see https://register.apple.com/resources/messages/msp-rest-api/type-interactive
 */

export type QuickReplyInteractive = {
  type: "quickReply";
  quickReply: {
    summaryText?: string;
    items: Array<{
      identifier: string;
      title: string;
    }>;
  };
};

export type ListPickerInteractive = {
  type: "listPicker";
  listPicker: {
    sections: Array<{
      title: string;
      multipleSelection?: boolean;
      items: Array<{
        identifier: string;
        title: string;
        subtitle?: string;
        imageUrl?: string;
      }>;
    }>;
  };
  /** Bubble shown before the sheet opens */
  receivedMessage: {
    title: string;
    subtitle?: string;
  };
};

export type FormInteractive = {
  type: "form";
  form: {
    title: string;
    pages: Array<{
      pageIdentifier: string;
      type: "input" | "select";
      title: string;
      subtitle?: string;
      options?: Array<{ identifier: string; title: string }>;
      placeholder?: string;
      inputType?: "text" | "number";
    }>;
  };
  receivedMessage: {
    title: string;
    subtitle?: string;
  };
};

export type InteractiveData =
  | QuickReplyInteractive
  | ListPickerInteractive
  | FormInteractive;

export type OutboundMessage =
  | { kind: "text"; id: string; body: string; from: "penny" | "user" }
  | {
      kind: "interactive";
      id: string;
      from: "penny";
      interactiveData: InteractiveData;
    };

export type UserReply =
  | { type: "text"; body: string }
  | { type: "quickReply"; identifier: string; title: string }
  | {
      type: "listPicker";
      selections: Array<{ identifier: string; title: string }>;
    }
  | {
      type: "form";
      answers: Record<string, string>;
    };
