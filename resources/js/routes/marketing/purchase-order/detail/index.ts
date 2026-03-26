import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:364
 * @route '/pembelian/purchase-order/{noPo}/detail/{detailId}'
 */
export const update = (args: { noPo: string | number, detailId: string | number } | [noPo: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/pembelian/purchase-order/{noPo}/detail/{detailId}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:364
 * @route '/pembelian/purchase-order/{noPo}/detail/{detailId}'
 */
update.url = (args: { noPo: string | number, detailId: string | number } | [noPo: string | number, detailId: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    noPo: args[0],
                    detailId: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPo: args.noPo,
                                detailId: args.detailId,
                }

    return update.definition.url
            .replace('{noPo}', parsedArgs.noPo.toString())
            .replace('{detailId}', parsedArgs.detailId.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:364
 * @route '/pembelian/purchase-order/{noPo}/detail/{detailId}'
 */
update.put = (args: { noPo: string | number, detailId: string | number } | [noPo: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:364
 * @route '/pembelian/purchase-order/{noPo}/detail/{detailId}'
 */
    const updateForm = (args: { noPo: string | number, detailId: string | number } | [noPo: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:364
 * @route '/pembelian/purchase-order/{noPo}/detail/{detailId}'
 */
        updateForm.put = (args: { noPo: string | number, detailId: string | number } | [noPo: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
const detail = {
    update: Object.assign(update, update),
}

export default detail