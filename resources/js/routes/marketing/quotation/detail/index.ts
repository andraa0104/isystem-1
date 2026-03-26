import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:294
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
export const update = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/marketing/quotation/{noPenawaran}/detail/{detailId}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:294
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
update.url = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    noPenawaran: args[0],
                    detailId: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPenawaran: args.noPenawaran,
                                detailId: args.detailId,
                }

    return update.definition.url
            .replace('{noPenawaran}', parsedArgs.noPenawaran.toString())
            .replace('{detailId}', parsedArgs.detailId.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:294
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
update.put = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:294
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
    const updateForm = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:294
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
        updateForm.put = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\Marketing\QuotationController::destroy
 * @see app/Http/Controllers/Marketing/QuotationController.php:321
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
export const destroy = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/marketing/quotation/{noPenawaran}/detail/{detailId}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::destroy
 * @see app/Http/Controllers/Marketing/QuotationController.php:321
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
destroy.url = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    noPenawaran: args[0],
                    detailId: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPenawaran: args.noPenawaran,
                                detailId: args.detailId,
                }

    return destroy.definition.url
            .replace('{noPenawaran}', parsedArgs.noPenawaran.toString())
            .replace('{detailId}', parsedArgs.detailId.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::destroy
 * @see app/Http/Controllers/Marketing/QuotationController.php:321
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
destroy.delete = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::destroy
 * @see app/Http/Controllers/Marketing/QuotationController.php:321
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
    const destroyForm = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: destroy.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::destroy
 * @see app/Http/Controllers/Marketing/QuotationController.php:321
 * @route '/marketing/quotation/{noPenawaran}/detail/{detailId}'
 */
        destroyForm.delete = (args: { noPenawaran: string | number, detailId: string | number } | [noPenawaran: string | number, detailId: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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