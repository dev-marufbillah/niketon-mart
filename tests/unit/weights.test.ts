import test from "node:test";
import assert from "node:assert/strict";
import { priceForWeighedLine } from "../../src/lib/weights/weight";
import { recountWeightOrder, weightApprovalSnapshot } from "../../src/lib/weights/approval";
import { hasUnresolvedWeights, orderFinancialExpectation, weightAdjustmentHoldReason } from "../../src/lib/weights/finance";
import type { Order } from "../../src/lib/repositories/orders";

function baseOrder(): Order {
  return { id: "order", number: "NM-1", currency: "BDT", status: "pending", paymentStatus: "unpaid", updatedAt: "test",
    subtotal: 13, total: 16.3, tax: 1.3, taxRate: 10, discount: 0, checkoutDiscount: 0, deliveryFee: 2,
    timeline: [], items: [{ price:13, quantity:1, lineTotal:13, weight: { unitGrams:1000, estimatedGrams:1000,
      originalLineTotal:13, status:"proposed", actualLineTotal:15.5, actualGrams:1200, difference:2.5 } }] } as unknown as Order;
}

test("weight preview includes tax; preparation remains a fixed charge per unit", () => {
  assert.equal(priceForWeighedLine(13, 0.5, 1, 1200, 1000), 15.5);
  assert.equal(priceForWeighedLine(11, 1, 2, 1500, 1000), 17);
  assert.equal(priceForWeighedLine(1, 0, 1, 1, 3), 0.33);
  assert.throws(() => priceForWeighedLine(1, 2, 1, 1000, 1000));
  assert.throws(() => priceForWeighedLine(1, 0, 1, 1.5, 1000));
  const order = baseOrder();
  assert.equal(weightAdjustmentHoldReason(order), null);
  const preview = weightApprovalSnapshot(order);
  assert.equal(preview.total, 19.05);
  assert.equal(recountWeightOrder(order, [{ ...order.items[0], lineTotal:15.5 }]).total, preview.total);
  assert.notEqual(weightApprovalSnapshot({ ...order, items:[{...order.items[0], lineTotal:12}] }).fingerprint, preview.fingerprint);
  assert.notEqual(weightApprovalSnapshot({ ...order, paymentStatus:"paid" }).fingerprint, preview.fingerprint);
});

test("checkout discount is frozen, capped on reductions, and restored on later customer-approved increases", () => {
  const order = { ...baseOrder(), subtotal:100, discount:80, checkoutDiscount:80, tax:2, total:32, deliveryFee:10,
    items:[{ ...baseOrder().items[0], lineTotal:100, weight:undefined }] };
  assert.equal(weightAdjustmentHoldReason(order), null);
  const lighterItems = [{...order.items[0], lineTotal:60}];
  const lighter = recountWeightOrder(order, lighterItems);
  assert.deepEqual(lighter, {subtotal:60, discount:60, checkoutDiscount:80, tax:0, total:10, taxRate:10});
  const reduced = {...order, ...lighter, items:lighterItems};
  assert.equal(weightAdjustmentHoldReason(reduced), null);
  const increased = recountWeightOrder(reduced, [{...lighterItems[0], lineTotal:90}]);
  assert.deepEqual(increased, {subtotal:90, discount:80, checkoutDiscount:80, tax:1, total:21, taxRate:10});
});

test("paid, historical, inconsistent and invalid proposals fail closed instead of rewriting amounts", () => {
  const order = baseOrder();
  assert.match(weightAdjustmentHoldReason({...order, paymentStatus:"paid"})!, /Payment/);
  assert.match(weightAdjustmentHoldReason({...order, paymentStatus:"awaiting_verification"})!, /Payment/);
  assert.match(weightAdjustmentHoldReason({...order, status:"out_for_delivery"})!, /delivery/);
  assert.match(weightAdjustmentHoldReason({...order, taxRate:undefined})!, /snapshot/);
  assert.match(weightAdjustmentHoldReason({...order, checkoutDiscount:undefined})!, /original checkout discount/);
  assert.throws(() => recountWeightOrder({...order, checkoutDiscount:undefined}, order.items), /checkout discount/);
  assert.match(weightAdjustmentHoldReason({...order, total:16.31})!, /reconcile/);
  assert.match(weightAdjustmentHoldReason({...order, items:[{...order.items[0], weight:{...order.items[0].weight!, actualLineTotal:12}}]})!, /inconsistent/);
  assert.equal(hasUnresolvedWeights(order), true);
  const expectation = orderFinancialExpectation(order);
  for (const key of ["items", "status", "paymentStatus", "payment", "currency", "subtotal", "discount", "checkoutDiscount", "deliveryFee", "tax", "taxRate", "total", "timeline", "updatedAt"]) assert(Object.hasOwn(expectation,key),key);
});
