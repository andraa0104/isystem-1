import quotation from './quotation'
import purchaseRequirement from './purchase-requirement'
import purchaseOrder from './purchase-order'
import deliveryOrder from './delivery-order'
const marketing = {
    quotation: Object.assign(quotation, quotation),
purchaseRequirement: Object.assign(purchaseRequirement, purchaseRequirement),
purchaseOrder: Object.assign(purchaseOrder, purchaseOrder),
deliveryOrder: Object.assign(deliveryOrder, deliveryOrder),
}

export default marketing