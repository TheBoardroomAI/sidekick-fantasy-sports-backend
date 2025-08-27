import { getStripeClient, STRIPE_PRICES, TIER_FEATURES } from "../config/stripe";
import { db, COLLECTIONS, SubscriptionTier } from "../config/firebase";
import { AuthService } from "./auth";

export class SubscriptionService {

  /**
   * Create a Stripe checkout session for subscription
   */
  static async createCheckoutSession(
    userId: string, 
    tier: SubscriptionTier, 
    interval: "monthly" | "yearly" = "monthly"
  ): Promise<string> {
    try {
      const stripe = getStripeClient(); // Lazy initialization at runtime
      
      const user = await AuthService.getUserByUid(userId);
      if (!user || !user.stripeCustomerId) {
        throw new Error("User or Stripe customer not found");
      }

      const priceId = STRIPE_PRICES[tier.toUpperCase() as keyof typeof STRIPE_PRICES][interval];
      
      const session = await stripe.checkout.sessions.create({
        customer: user.stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/pricing`,
        metadata: {
          userId: userId,
          tier: tier
        }
      });

      return session.url!;
    } catch (error: any) {
      throw new Error(`Failed to create checkout session: ${error}`);
    }
  }

  /**
   * Handle successful subscription creation
   */
  static async handleSubscriptionCreated(subscription: any): Promise<void> {
    try {
      const customerId = subscription.customer;
      const subscriptionId = subscription.id;
      
      // Find user by Stripe customer ID
      const usersQuery = await db.collection(COLLECTIONS.USERS)
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        throw new Error("User not found for Stripe customer");
      }

      const userDoc = usersQuery.docs[0];
      const userId = userDoc.id;

      // Determine subscription tier from price ID
      const priceId = subscription.items.data[0].price.id;
      const tier = this.getTierFromPriceId(priceId);

      // Update user subscription status
      await AuthService.updateUser(userId, {
        subscriptionTier: tier,
        subscriptionStatus: "active",
        subscriptionId: subscriptionId
      });

    } catch (error: any) {
      throw new Error(`Failed to handle subscription created: ${error}`);
    }
  }

  /**
   * Handle subscription cancellation
   */
  static async handleSubscriptionCanceled(subscription: any): Promise<void> {
    try {
      const subscriptionId = subscription.id;
      
      // Find user by subscription ID
      const usersQuery = await db.collection(COLLECTIONS.USERS)
        .where("subscriptionId", "==", subscriptionId)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        throw new Error("User not found for subscription");
      }

      const userDoc = usersQuery.docs[0];
      const userId = userDoc.id;

      // Update user to Rookie tier
      await AuthService.updateUser(userId, {
        subscriptionTier: "rookie",
        subscriptionStatus: "canceled"
      });

    } catch (error: any) {
      throw new Error(`Failed to handle subscription canceled: ${error}`);
    }
  }

  /**
   * Get subscription tier from Stripe price ID
   */
  private static getTierFromPriceId(priceId: string): SubscriptionTier {
    for (const [tier, prices] of Object.entries(STRIPE_PRICES)) {
      if (prices.monthly === priceId || prices.yearly === priceId) {
        return tier.toLowerCase() as SubscriptionTier;
      }
    }
    return "rookie"; // Default fallback
  }

  /**
   * Check if user has access to feature
   */
  static hasFeatureAccess(userTier: SubscriptionTier, feature: keyof typeof TIER_FEATURES.ROOKIE): boolean {
    const tierFeatures = TIER_FEATURES[userTier.toUpperCase() as keyof typeof TIER_FEATURES];
    return tierFeatures[feature] as boolean;
  }

  /**
   * Check if user can access persona
   */
  static canAccessPersona(userTier: SubscriptionTier, persona: string): boolean {
    const tierFeatures = TIER_FEATURES[userTier.toUpperCase() as keyof typeof TIER_FEATURES];
    return tierFeatures.personas.includes(persona);
  }

  /**
   * Get user's subscription status
   */
  static async getSubscriptionStatus(userId: string): Promise<any> {
    try {
      const user = await AuthService.getUserByUid(userId);
      if (!user || !user.subscriptionId) {
        return { status: "inactive", tier: "rookie" };
      }

      const stripe = getStripeClient(); // Lazy initialization
      const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);
      
      return {
        status: subscription.status,
        tier: user.subscriptionTier,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      };
    } catch (error: any) {
      throw new Error(`Failed to get subscription status: ${error}`);
    }
  }

  /**
   * Validate Stripe webhook signature
   */
  static validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!endpointSecret) {
        throw new Error("Webhook secret not configured");
      }

      stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      return true;
    } catch (error: any) {
      console.error("Webhook signature validation failed:", error?.message || "Unknown error");
      return false;
    }
  }

  /**
   * Process Stripe webhook event
   */
  static async processWebhookEvent(event: any): Promise<void> {
    try {
      switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdate(event.data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionCancellation(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await this.handlePaymentSuccess(event.data.object);
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      console.error("Webhook event processing failed:", error?.message || "Unknown error");
      throw error;
    }
  }

  private static async handleSubscriptionUpdate(subscription: any): Promise<void> {
    // Implementation for subscription updates
    console.log("Handling subscription update:", subscription.id);
  }

  private static async handleSubscriptionCancellation(subscription: any): Promise<void> {
    // Implementation for subscription cancellation
    console.log("Handling subscription cancellation:", subscription.id);
  }

  private static async handlePaymentSuccess(invoice: any): Promise<void> {
    // Implementation for payment success
    console.log("Handling payment success:", invoice.id);
  }

  private static async handlePaymentFailure(invoice: any): Promise<void> {
    // Implementation for payment failure
    console.log("Handling payment failure:", invoice.id);
  }
}

