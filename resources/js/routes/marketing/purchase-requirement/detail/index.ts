import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:262
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
export const update = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/marketing/purchase-requirement/{noPr}/detail/{detailNo}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:262
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
update.url = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    noPr: args[0],
                    detailNo: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPr: args.noPr,
                                detailNo: args.detailNo,
                }

    return update.definition.url
            .replace('{noPr}', parsedArgs.noPr.toString())
            .replace('{detailNo}', parsedArgs.detailNo.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:262
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
update.put = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:262
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
    const updateForm = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:262
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
        updateForm.put = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::destroy
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:297
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
export const destroy = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/marketing/purchase-requirement/{noPr}/detail/{detailNo}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::destroy
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:297
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
destroy.url = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    noPr: args[0],
                    detailNo: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPr: args.noPr,
                                detailNo: args.detailNo,
                }

    return destroy.definition.url
            .replace('{noPr}', parsedArgs.noPr.toString())
            .replace('{detailNo}', parsedArgs.detailNo.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::destroy
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:297
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
destroy.delete = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::destroy
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:297
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
    const destroyForm = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: destroy.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::destroy
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:297
 * @route '/marketing/purchase-requirement/{noPr}/detail/{detailNo}'
 */
        destroyForm.delete = (args: { noPr: string | number, detailNo: string | number } | [noPr: string | number, detailNo: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: destroy.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'DELETE',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    destroy.form = destroyForm
const detail = {
    update: Object.assign(update, update),
destroy: Object.assign(destroy, destroy),
}

export default detail