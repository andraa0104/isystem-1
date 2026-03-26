import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/marketing/delivery-order/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
    const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: create.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
        createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::create
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:123
 * @route '/marketing/delivery-order/create'
 */
        createForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    create.form = createForm
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
export const searchPr = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: searchPr.url(options),
    method: 'get',
})

searchPr.definition = {
    methods: ["get","head"],
    url: '/marketing/delivery-order/search-pr',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
searchPr.url = (options?: RouteQueryOptions) => {
    return searchPr.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
searchPr.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: searchPr.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
searchPr.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: searchPr.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
    const searchPrForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: searchPr.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
        searchPrForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: searchPr.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::searchPr
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:128
 * @route '/marketing/delivery-order/search-pr'
 */
        searchPrForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: searchPr.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    searchPr.form = searchPrForm
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
export const getPrDetails = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: getPrDetails.url(options),
    method: 'get',
})

getPrDetails.definition = {
    methods: ["get","head"],
    url: '/marketing/delivery-order/get-pr-details',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
getPrDetails.url = (options?: RouteQueryOptions) => {
    return getPrDetails.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
getPrDetails.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: getPrDetails.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
getPrDetails.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: getPrDetails.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
    const getPrDetailsForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: getPrDetails.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
        getPrDetailsForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: getPrDetails.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::getPrDetails
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:151
 * @route '/marketing/delivery-order/get-pr-details'
 */
        getPrDetailsForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: getPrDetails.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    getPrDetails.form = getPrDetailsForm
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/marketing/delivery-order',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::index
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:11
 * @route '/marketing/delivery-order'
 */
        indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    index.form = indexForm
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
export const print = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})

print.definition = {
    methods: ["get","head"],
    url: '/marketing/delivery-order/{noDo}/print',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
print.url = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noDo: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noDo: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noDo: args.noDo,
                }

    return print.definition.url
            .replace('{noDo}', parsedArgs.noDo.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
print.get = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
print.head = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: print.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
    const printForm = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: print.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
        printForm.get = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\DeliveryOrderController::print
 * @see app/Http/Controllers/Marketing/DeliveryOrderController.php:65
 * @route '/marketing/delivery-order/{noDo}/print'
 */
        printForm.head = (args: { noDo: string | number } | [noDo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    print.form = printForm
const deliveryOrder = {
    create: Object.assign(create, create),
searchPr: Object.assign(searchPr, searchPr),
getPrDetails: Object.assign(getPrDetails, getPrDetails),
index: Object.assign(index, index),
print: Object.assign(print, print),
}

export default deliveryOrder