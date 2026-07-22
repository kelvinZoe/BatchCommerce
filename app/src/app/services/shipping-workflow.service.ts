import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { from, SupabaseDataAccessService } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class ShippingWorkflowService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  sendConfirmedArrivalsToShipping(batchName: string): Observable<boolean> {
    return from(this.doSendConfirmedArrivalsToShipping(batchName));
  }

  sendConfirmedArrivalItemToShipping(arrivalItemId: number): Observable<boolean> {
    return from(this.doSendConfirmedArrivalItemToShipping(arrivalItemId));
  }

  sendPaidClientToDeliveries(batchName: string, clientId: number): Observable<boolean> {
    return from(this.doSendPaidClientToDeliveries(batchName, clientId));
  }

  private async doSendConfirmedArrivalsToShipping(batchName: string): Promise<boolean> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('send_confirmed_arrivals_to_shipping', {
      p_shop_id: shopId,
      p_batch_name: batchName
    });

    if (error) {
      console.error(`[shipping-workflow] Failed sending confirmed arrivals to shipping for batch ${batchName}:`, error);
      return false;
    }

    return Boolean(data);
  }

  private async doSendConfirmedArrivalItemToShipping(arrivalItemId: number): Promise<boolean> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('send_confirmed_arrival_item_to_shipping', {
      p_shop_id: shopId,
      p_arrival_item_id: arrivalItemId
    });

    if (error) {
      console.error(`[shipping-workflow] Failed sending arrival item ${arrivalItemId} to shipping:`, error);
      return false;
    }

    return Boolean(data);
  }

  private async doSendPaidClientToDeliveries(batchName: string, clientId: number): Promise<boolean> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('send_paid_client_to_deliveries', {
      p_shop_id: shopId,
      p_batch_name: batchName,
      p_client_id: clientId
    });

    if (error) {
      console.error(`[shipping-workflow] Failed sending paid client ${clientId} to deliveries for batch ${batchName}:`, error);
      return false;
    }

    return Boolean(data);
  }
}
