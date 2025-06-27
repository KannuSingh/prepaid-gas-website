"use client";

import { Counter } from "@/components/features/counter/counter";
import { PaymasterSettings } from "@/components/features/paymaster/paymaster-settings";
import { usePaymaster } from "@/context/PaymasterContext";
import { useSmartAccount } from "@/context/SmartAccountContext";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { AlertTriangle, Settings, CheckCircle } from "lucide-react";

export default function Home() {
  const { isConfigured: paymasterConfigured, paymasterConfig } = usePaymaster();
  const { smartAccountClient } = useSmartAccount();

  const isFullyConfigured = paymasterConfigured && smartAccountClient;

  return (
    <div className="space-y-8">
      {/* Header with Settings */}
      <div className="text-center space-y-4 relative">
        {/* Settings Button */}
        <div className="absolute top-0 right-0">
          <PaymasterSettings />
        </div>

        <h1 className="text-4xl font-bold tracking-tight">Counter DApp</h1>
        <p className="text-xl text-muted-foreground">
          Smart Accounts + Anonymous Gas Coupon Paymasters
        </p>
      </div>

      {/* Configuration Status */}
      <div className="flex flex-col items-center space-y-4">
        {!paymasterConfigured ? (
          // Paymaster configuration required
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between w-full">
              <div>
                <div className="font-medium">
                  Paymaster Configuration Required
                </div>
                <div className="text-sm">
                  Configure your paymaster to begin using the app
                </div>
              </div>
              <PaymasterSettings>
                <button className="text-sm underline hover:no-underline">
                  Configure Now
                </button>
              </PaymasterSettings>
            </AlertDescription>
          </Alert>
        ) : !smartAccountClient ? (
          // Paymaster configured but smart account client not ready
          <Alert className="max-w-md border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
            <Settings className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="font-medium">Setting Up Smart Account</div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-300">
                    Group #{paymasterConfig?.poolId} • Creating smart account
                    client...
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          // Everything ready
          <Alert className="max-w-md border-green-200 bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="font-medium">System Ready</div>
                  <div className="text-sm text-green-600 dark:text-green-300">
                    Group #{paymasterConfig?.poolId} • Smart Account Active
                  </div>
                </div>
                <PaymasterSettings>
                  <button className="text-sm underline hover:no-underline text-green-600">
                    Edit
                  </button>
                </PaymasterSettings>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Counter />
      </div>
    </div>
  );
}
