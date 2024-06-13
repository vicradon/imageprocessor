import axios from "axios";

const completeWebhookHandshake = async (eventObj) => {
  const { eventType, data } = eventObj;
  if (eventType === "Microsoft.EventGrid.SubscriptionValidationEvent") {
    try {
      await axios.get(data.validationUrl);
    } catch (error) {
      console.log(error);
    }
  }
};

export default completeWebhookHandshake;
